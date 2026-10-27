import type { PrismaClient, Prisma } from "@prisma/client";
import type { AdminFieldSchema } from "./exam-config";
import { sentenceOrderMatches } from "./sentence-answer";
import { deliveryMetadata } from "./toefl-delivery";
import { gradeToeflAttempt } from "./toefl-grading";
import { detMetadata, detPoints } from "./det-format";
import { gradeDetAttempt } from "./det-grading";

/*
 * Calificación genérica dirigida por datos:
 * - Tipos cerrados (MULTIPLE_CHOICE, DRAG_SELECT, FILL_BLANK, TYPE_TEXT)
 *   se comparan contra correctAnswer (o contra las correctas anidadas en
 *   repeaters del promptContent).
 * - FREE_TEXT y AUDIO_RECORDING quedan en isCorrect = null → revisión humana.
 * - isScored = false nunca se califica (patrón Writing/Speaking Sample).
 *
 * Convención de salida (la consumen métricas y resultados):
 *   Attempt.overallScore = { value: number, band?: number, pending?: boolean }
 *   Attempt.subscores    = { "<subscore>": number, ... }
 */

const OPEN_RESPONSE_TYPES = new Set(["FREE_TEXT", "AUDIO_RECORDING"]);

function norm(s: string): string {
  return s.trim().toLowerCase();
}

/** Comparación laxa para dictados: minúsculas, sin puntuación, espacios colapsados */
function normLoose(s: string): string {
  return s
    .toLowerCase()
    .replace(/[.,;:!?¡¿'"´`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function setEqual(a: number[], b: unknown): boolean {
  if (!Array.isArray(b) || a.length !== b.length) return false;
  const sa = [...a].sort();
  const sb = [...(b as number[])].sort();
  return sa.every((v, i) => v === sb[i]);
}

function valuesMatch(expected: unknown, got: unknown): boolean {
  if (typeof expected === "number") return got === expected;
  if (Array.isArray(expected)) return setEqual(expected as number[], got);
  if (typeof expected === "string" && typeof got === "string")
    return norm(expected) === norm(got);
  return JSON.stringify(expected) === JSON.stringify(got);
}

function firstString(obj: Record<string, unknown> | null): string | null {
  if (!obj) return null;
  for (const v of Object.values(obj)) if (typeof v === "string") return v;
  return null;
}

function firstArray(obj: Record<string, unknown> | null): unknown[] | null {
  if (!obj) return null;
  for (const v of Object.values(obj)) if (Array.isArray(v)) return v;
  return null;
}

export function autoGradeResponse(input: {
  responseType: string;
  isScored: boolean;
  adminFieldSchema: AdminFieldSchema;
  promptContent: Record<string, unknown>;
  correctAnswer: Record<string, unknown> | null;
  answerContent: Record<string, unknown>;
}): boolean | null {
  const { responseType, isScored, adminFieldSchema, promptContent, correctAnswer, answerContent } =
    input;

  if (!isScored) return null;
  if (OPEN_RESPONSE_TYPES.has(responseType)) return null;
  if (detMetadata(promptContent)) {
    const points=detPoints(promptContent,correctAnswer,answerContent);
    return points.possible>0?points.earned===points.possible:null;
  }

  if (responseType === "DRAG_SELECT" && Array.isArray(promptContent.wordBank)) {
    if (!Array.isArray(correctAnswer?.order)) return null;
    const alternatives = Array.isArray(correctAnswer.acceptedOrders) ? correctAnswer.acceptedOrders : [];
    return [correctAnswer.order, ...alternatives].some((order) => Array.isArray(order) &&
      sentenceOrderMatches(order, answerContent.order, promptContent.wordBank, promptContent.slots));
  }

  switch (responseType) {
    case "MULTIPLE_CHOICE":
    case "DRAG_SELECT": {
      if (correctAnswer && Object.keys(correctAnswer).length > 0) {
        return Object.entries(correctAnswer).every(([key, expected]) =>
          valuesMatch(expected, answerContent[key]),
        );
      }
      // respuestas anidadas en repeater (Interactive Reading / Listening)
      const repeater = adminFieldSchema.fields.find(
        (f) =>
          f.type === "repeater" &&
          f.itemFields?.some((x) => x.type === "options" && x.withCorrect),
      );
      if (repeater) {
        const optField = repeater.itemFields!.find((x) => x.type === "options")!;
        const items = (promptContent[repeater.key] as Record<string, unknown>[]) ?? [];
        const chosen = (answerContent[repeater.key] as unknown[]) ?? [];
        if (items.length === 0) return null;
        return items.every((item, i) => {
          const stored = item[optField.key] as { correct?: unknown } | undefined;
          return stored?.correct !== undefined && valuesMatch(stored.correct, chosen[i]);
        });
      }
      return null;
    }

    case "FILL_BLANK": {
      const expected = firstArray(correctAnswer) as string[] | null;
      const got = (answerContent.answers as string[]) ?? [];
      if (!expected || expected.length === 0) return null;
      return (
        expected.length === got.length &&
        expected.every((e, i) => norm(String(e)) === norm(String(got[i] ?? "")))
      );
    }

    case "TYPE_TEXT": {
      const expected = firstString(correctAnswer);
      const got =
        typeof answerContent.text === "string" ? answerContent.text : firstString(answerContent);
      if (expected === null) return null;
      if (got === null) return false;
      return normLoose(expected) === normLoose(got);
    }

    default:
      return null;
  }
}

/* ───────────── Escalas ───────────── */

type Scale = { min: number; max: number; step?: number };

function mapToScale(pct: number, scale: Scale): number {
  const step = scale.step ?? 1;
  const raw = scale.min + pct * (scale.max - scale.min);
  const stepped = Math.round(raw / step) * step;
  const clamped = Math.min(scale.max, Math.max(scale.min, stepped));
  return Number(clamped.toFixed(2));
}

function parseScales(scoreScale: Record<string, unknown>): {
  primary: Scale;
  band: Scale | null;
  subscale: Scale;
} {
  const asScale = (o: unknown): Scale | null => {
    if (
      o &&
      typeof o === "object" &&
      typeof (o as Scale).min === "number" &&
      typeof (o as Scale).max === "number"
    )
      return o as Scale;
    return null;
  };
  const top = asScale(scoreScale);
  const total = asScale(scoreScale.total);
  const band = asScale(scoreScale.band);
  const primary = top ?? total ?? { min: 0, max: 100 };
  const subscale = asScale(scoreScale.subscale) ?? primary;
  return { primary, band, subscale };
}

/* ───────────── Calificar y finalizar un intento ─────────────
 * autoGrade: true al completar (califica cerradas); false al recalcular
 * tras revisión manual (respeta lo que puso el admin).
 */
export async function gradeAttempt(
  prisma: PrismaClient | Prisma.TransactionClient,
  attemptId: string,
  { autoGrade }: { autoGrade: boolean },
): Promise<{ status: "COMPLETED" | "PENDING_REVIEW"; pendingCount: number }> {
  const attempt = await prisma.attempt.findUniqueOrThrow({
    where: { id: attemptId },
    include: {
      student: { select: { fullName: true } },
      responses: { include: { question: { include: { questionType: true } } } },
      examVersion: {
        include: {
          examType: true,
          questions: { include: { questionType: true } },
        },
      },
    },
  });

  const examType = attempt.examVersion.examType;
  if (attempt.examVersion.questions.some((q) => detMetadata(q.promptContent))) return gradeDetAttempt(prisma, attempt);
  if (attempt.examVersion.questions.some((q) => deliveryMetadata(q.promptContent))) return gradeToeflAttempt(prisma, attempt);
  const { primary, band, subscale } = parseScales(
    examType.scoreScale as Record<string, unknown>,
  );
  const subscoreNames = examType.subscoreDefinitions as string[];

  /* 1 · calificar cerradas sin veredicto */
  const gradeUpdates: { id: string; isCorrect: boolean }[] = [];
  const verdicts = new Map<string, boolean | null>(); // questionId → isCorrect

  for (const response of attempt.responses) {
    let isCorrect: boolean | null = response.isCorrect;
    if (isCorrect === null && autoGrade) {
      isCorrect = autoGradeResponse({
        responseType: response.question.questionType.responseType,
        isScored: response.question.questionType.isScored,
        adminFieldSchema: response.question.questionType
          .adminFieldSchema as AdminFieldSchema,
        promptContent: response.question.promptContent as Record<string, unknown>,
        correctAnswer: response.question.correctAnswer as Record<string, unknown> | null,
        answerContent: response.answerContent as Record<string, unknown>,
      });
      if (isCorrect !== null) gradeUpdates.push({ id: response.id, isCorrect });
    }
    verdicts.set(response.questionId, isCorrect);
  }

  /* 2 · respuestas abiertas pendientes de revisión humana */
  const pendingCount = attempt.responses.filter(
    (r) =>
      OPEN_RESPONSE_TYPES.has(r.question.questionType.responseType) &&
      (verdicts.get(r.questionId) ?? null) === null,
  ).length;

  /* 3 · scores sobre las preguntas calificables (isScored) */
  type Item = { isCorrect: boolean | null; subscoreMapping: string[] };
  const items: Item[] = attempt.examVersion.questions
    .filter((q) => q.questionType.isScored)
    .map((q) => {
      const hasResponse = attempt.responses.some((r) => r.questionId === q.id);
      const verdict = verdicts.get(q.id) ?? null;
      return {
        // sin respuesta = incorrecta; abierta sin revisar = null (fuera del cálculo parcial)
        isCorrect: hasResponse ? verdict : false,
        subscoreMapping: q.questionType.subscoreMapping,
      };
    });

  const pct = (subset: Item[]): number | null => {
    const graded = subset.filter((i) => i.isCorrect !== null);
    if (graded.length === 0) return null;
    return graded.filter((i) => i.isCorrect === true).length / graded.length;
  };

  const overallPct = pct(items);
  const overallScore: Record<string, unknown> = {
    value: overallPct === null ? null : mapToScale(overallPct, primary),
    ...(band && overallPct !== null ? { band: mapToScale(overallPct, band) } : {}),
    ...(pendingCount > 0 ? { pending: true } : {}),
  };

  const subscores: Record<string, number> = {};
  for (const name of subscoreNames) {
    const subsetPct = pct(items.filter((i) => i.subscoreMapping.includes(name)));
    if (subsetPct !== null) subscores[name] = mapToScale(subsetPct, subscale);
  }

  const status = pendingCount > 0 ? "PENDING_REVIEW" : "COMPLETED";

  /* 4 · persistir en una transacción + notificación */
  const persistGrades = async (tx: Prisma.TransactionClient) => {
    for (const u of gradeUpdates) {
      await tx.response.update({ where: { id: u.id }, data: { isCorrect: u.isCorrect } });
    }
    await tx.attempt.update({
      where: { id: attempt.id },
      data: {
        status,
        completedAt: attempt.completedAt ?? new Date(),
        overallScore: overallScore as Prisma.InputJsonValue,
        subscores: subscores as Prisma.InputJsonValue,
      },
    });

    if (status === "PENDING_REVIEW") {
      const existing = await tx.notification.findFirst({
        where: { attemptId: attempt.id, type: "ATTEMPT_PENDING_REVIEW" },
      });
      if (!existing) {
        await tx.notification.create({
          data: {
            type: "ATTEMPT_PENDING_REVIEW",
            attemptId: attempt.id,
            message: `${attempt.student.fullName} completó ${examType.name} — ${attempt.examVersion.label}: ${pendingCount} respuesta(s) por revisar.`,
            payload: { pendingCount },
          },
        });
      }
    } else {
      await tx.notification.updateMany({
        where: { attemptId: attempt.id, isRead: false },
        data: { isRead: true },
      });
    }
  };
  if ("$transaction" in prisma) await prisma.$transaction(persistGrades);
  else await persistGrades(prisma);

  return { status, pendingCount };
}
