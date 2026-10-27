"use server";

import { revalidatePath, updateTag } from "next/cache";
import { EXAM_CONTENT_TAG } from "@/lib/exam-content";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { getAppSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import {
  adminFieldSchemaZ,
  defaultThemeConfig,
  validateQuestionPayload,
  type AdminFieldSchema,
} from "@/lib/exam-config";

export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

async function requireAdmin() {
  const session = await getAppSession();
  if (!session || session.user.role !== "ADMIN") {
    throw new Error("No autorizado");
  }
  return session;
}

function fail(error: unknown, fallback: string): { ok: false; error: string } {
  if (error instanceof z.ZodError) {
    return { ok: false, error: error.issues.map((i) => i.message).join(" · ") };
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") return { ok: false, error: "Ya existe un registro con ese valor único." };
    if (error.code === "P2003")
      return { ok: false, error: "No se puede eliminar: hay registros que dependen de este elemento." };
  }
  console.error(fallback, error);
  return { ok: false, error: fallback };
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function revalidateExam(slug: string) {
  updateTag(EXAM_CONTENT_TAG);
  revalidatePath("/admin");
  revalidatePath(`/admin/examenes/${slug}`, "layout");
}

/* ═══════════════ ExamType ═══════════════ */

const examTypeInput = z.object({
  name: z.string().min(2, "Nombre demasiado corto"),
  description: z.string().optional(),
  totalDurationMinutes: z.coerce.number().int().positive("Duración inválida"),
  sectionOrderMode: z.enum(["FIXED", "MIXED"]),
  hasAdaptiveLogic: z.boolean(),
  subscoreDefinitions: z.array(z.string().min(1)).min(1, "Define al menos un subscore"),
  scoreScale: z.record(z.string(), z.unknown()),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Color inválido"),
});

export async function createExamType(
  input: z.infer<typeof examTypeInput>,
): Promise<ActionResult<{ slug: string }>> {
  try {
    await requireAdmin();
    const data = examTypeInput.parse(input);

    let slug = slugify(data.name);
    const clash = await prisma.examType.findUnique({ where: { slug } });
    if (clash) slug = `${slug}-${Date.now().toString(36)}`;

    await prisma.examType.create({
      data: {
        name: data.name,
        slug,
        description: data.description || null,
        totalDurationMinutes: data.totalDurationMinutes,
        sectionOrderMode: data.sectionOrderMode,
        hasAdaptiveLogic: data.hasAdaptiveLogic,
        subscoreDefinitions: data.subscoreDefinitions,
        scoreScale: data.scoreScale as Prisma.InputJsonValue,
        themeConfig: defaultThemeConfig(data.accentColor) as unknown as Prisma.InputJsonValue,
      },
    });

    revalidatePath("/admin");
    return { ok: true, data: { slug } };
  } catch (e) {
    return fail(e, "No se pudo crear el examen.");
  }
}

/* ═══════════════ Section ═══════════════ */

const sectionInput = z.object({
  examTypeId: z.string().min(1),
  slug: z.string().min(1),
  name: z.string().min(1, "El nombre es requerido"),
  order: z.coerce.number().int().positive().nullable(),
  durationMinutes: z.coerce.number().int().positive("Duración inválida"),
  skillsMeasured: z
    .array(z.enum(["READING", "WRITING", "LISTENING", "SPEAKING"]))
    .min(1, "Selecciona al menos una habilidad"),
});

export async function createSection(
  input: z.infer<typeof sectionInput>,
): Promise<ActionResult> {
  try {
    await requireAdmin();
    const data = sectionInput.parse(input);
    await prisma.section.create({
      data: {
        examTypeId: data.examTypeId,
        name: data.name,
        order: data.order,
        durationMinutes: data.durationMinutes,
        skillsMeasured: data.skillsMeasured,
      },
    });
    revalidateExam(data.slug);
    return { ok: true };
  } catch (e) {
    return fail(e, "No se pudo crear la sección.");
  }
}

export async function updateSection(
  id: string,
  input: z.infer<typeof sectionInput>,
): Promise<ActionResult> {
  try {
    await requireAdmin();
    const data = sectionInput.parse(input);
    await prisma.section.update({
      where: { id },
      data: {
        name: data.name,
        order: data.order,
        durationMinutes: data.durationMinutes,
        skillsMeasured: data.skillsMeasured,
      },
    });
    revalidateExam(data.slug);
    return { ok: true };
  } catch (e) {
    return fail(e, "No se pudo actualizar la sección.");
  }
}

export async function deleteSection(id: string, slug: string): Promise<ActionResult> {
  try {
    await requireAdmin();
    const withQuestions = await prisma.question.count({
      where: { questionType: { sectionId: id } },
    });
    if (withQuestions > 0) {
      return {
        ok: false,
        error: `La sección tiene ${withQuestions} pregunta(s) cargada(s). Elimínalas primero.`,
      };
    }
    await prisma.section.delete({ where: { id } });
    revalidateExam(slug);
    return { ok: true };
  } catch (e) {
    return fail(e, "No se pudo eliminar la sección.");
  }
}

/* ═══════════════ QuestionType ═══════════════ */

const questionTypeInput = z.object({
  sectionId: z.string().min(1),
  slug: z.string().min(1),
  name: z.string().min(1, "El nombre es requerido"),
  inputMedia: z.enum(["TEXT", "AUDIO", "IMAGE", "VIDEO", "CONVERSATION"]),
  responseType: z.enum([
    "MULTIPLE_CHOICE",
    "DRAG_SELECT",
    "FILL_BLANK",
    "TYPE_TEXT",
    "AUDIO_RECORDING",
    "FREE_TEXT",
  ]),
  timingMode: z.enum(["PER_QUESTION", "PER_SECTION"]),
  timePerItemSeconds: z.coerce.number().int().positive().nullable(),
  prepTimeSeconds: z.coerce.number().int().positive().nullable(),
  replaysAllowed: z.coerce.number().int().positive().nullable(),
  isScored: z.boolean(),
  subscoreMapping: z.array(z.string()),
  adminFieldSchema: z.string().min(2, "Define el esquema de campos"),
});

async function parseQuestionTypeInput(input: z.infer<typeof questionTypeInput>) {
  const data = questionTypeInput.parse(input);

  let parsedSchema: unknown;
  try {
    parsedSchema = JSON.parse(data.adminFieldSchema);
  } catch {
    throw new z.ZodError([
      { code: "custom", message: "adminFieldSchema no es JSON válido", path: ["adminFieldSchema"], input: data.adminFieldSchema },
    ]);
  }
  const fieldSchema = adminFieldSchemaZ.parse(parsedSchema);

  // El mapping solo puede apuntar a subscores que el examen define
  const section = await prisma.section.findUniqueOrThrow({
    where: { id: data.sectionId },
    include: { examType: true },
  });
  const defs = section.examType.subscoreDefinitions as string[];
  const bad = data.subscoreMapping.filter((m) => !defs.includes(m));
  if (bad.length) {
    throw new z.ZodError([
      {
        code: "custom",
        message: `Subscores no definidos en este examen: ${bad.join(", ")}`,
        path: ["subscoreMapping"],
        input: data.subscoreMapping,
      },
    ]);
  }

  if (data.timingMode === "PER_QUESTION" && !data.timePerItemSeconds) {
    throw new z.ZodError([
      {
        code: "custom",
        message: "Con timing PER_QUESTION debes indicar segundos por pregunta",
        path: ["timePerItemSeconds"],
        input: null,
      },
    ]);
  }

  return { data, fieldSchema };
}

export async function createQuestionType(
  input: z.infer<typeof questionTypeInput>,
): Promise<ActionResult> {
  try {
    await requireAdmin();
    const { data, fieldSchema } = await parseQuestionTypeInput(input);
    await prisma.questionType.create({
      data: {
        sectionId: data.sectionId,
        name: data.name,
        inputMedia: data.inputMedia,
        responseType: data.responseType,
        timingMode: data.timingMode,
        timePerItemSeconds: data.timingMode === "PER_QUESTION" ? data.timePerItemSeconds : null,
        prepTimeSeconds: data.prepTimeSeconds,
        replaysAllowed: data.replaysAllowed,
        isScored: data.isScored,
        subscoreMapping: data.subscoreMapping,
        adminFieldSchema: fieldSchema,
      },
    });
    revalidateExam(data.slug);
    return { ok: true };
  } catch (e) {
    return fail(e, "No se pudo crear el tipo de pregunta.");
  }
}

export async function updateQuestionType(
  id: string,
  input: z.infer<typeof questionTypeInput>,
): Promise<ActionResult> {
  try {
    await requireAdmin();
    const { data, fieldSchema } = await parseQuestionTypeInput(input);
    await prisma.questionType.update({
      where: { id },
      data: {
        name: data.name,
        inputMedia: data.inputMedia,
        responseType: data.responseType,
        timingMode: data.timingMode,
        timePerItemSeconds: data.timingMode === "PER_QUESTION" ? data.timePerItemSeconds : null,
        prepTimeSeconds: data.prepTimeSeconds,
        replaysAllowed: data.replaysAllowed,
        isScored: data.isScored,
        subscoreMapping: data.subscoreMapping,
        adminFieldSchema: fieldSchema,
      },
    });
    revalidateExam(data.slug);
    return { ok: true };
  } catch (e) {
    return fail(e, "No se pudo actualizar el tipo de pregunta.");
  }
}

export async function deleteQuestionType(id: string, slug: string): Promise<ActionResult> {
  try {
    await requireAdmin();
    const count = await prisma.question.count({ where: { questionTypeId: id } });
    if (count > 0) {
      return {
        ok: false,
        error: `Este tipo tiene ${count} pregunta(s) cargada(s). Elimínalas primero.`,
      };
    }
    await prisma.questionType.delete({ where: { id } });
    revalidateExam(slug);
    return { ok: true };
  } catch (e) {
    return fail(e, "No se pudo eliminar el tipo de pregunta.");
  }
}

/* ═══════════════ ExamVersion ═══════════════ */

const versionInput = z.object({
  examTypeId: z.string().min(1),
  slug: z.string().min(1),
  label: z.string().min(1, "La etiqueta es requerida"),
  hasFeedback: z.boolean(),
});

export async function createVersion(
  input: z.infer<typeof versionInput>,
): Promise<ActionResult> {
  try {
    await requireAdmin();
    const data = versionInput.parse(input);
    await prisma.examVersion.create({
      data: {
        examTypeId: data.examTypeId,
        label: data.label,
        hasFeedback: data.hasFeedback,
        isPublished: false,
      },
    });
    revalidateExam(data.slug);
    return { ok: true };
  } catch (e) {
    return fail(e, "No se pudo crear la versión.");
  }
}

export async function updateVersion(
  id: string,
  slug: string,
  patch: { label?: string; hasFeedback?: boolean; isPublished?: boolean },
): Promise<ActionResult> {
  try {
    await requireAdmin();
    await prisma.examVersion.update({ where: { id }, data: patch });
    revalidateExam(slug);
    return { ok: true };
  } catch (e) {
    return fail(e, "No se pudo actualizar la versión.");
  }
}

export async function deleteVersion(id: string, slug: string): Promise<ActionResult> {
  try {
    await requireAdmin();
    const attempts = await prisma.attempt.count({ where: { examVersionId: id } });
    if (attempts > 0) {
      return {
        ok: false,
        error: `Hay ${attempts} intento(s) de alumnos sobre esta versión; no se puede eliminar.`,
      };
    }
    await prisma.examVersion.delete({ where: { id } });
    revalidateExam(slug);
    return { ok: true };
  } catch (e) {
    return fail(e, "No se pudo eliminar la versión.");
  }
}

/* ═══════════════ Question ═══════════════ */

const questionInput = z.object({
  slug: z.string().min(1),
  examVersionId: z.string().min(1),
  questionTypeId: z.string().min(1),
  promptContent: z.record(z.string(), z.unknown()),
  correctAnswer: z.record(z.string(), z.unknown()).nullable(),
  feedbackText: z.string().nullable(),
  difficultyLevel: z.coerce.number().int().min(1).max(5).nullable(),
});

async function validateAgainstType(
  questionTypeId: string,
  promptContent: Record<string, unknown>,
  correctAnswer: Record<string, unknown> | null,
) {
  const qt = await prisma.questionType.findUniqueOrThrow({
    where: { id: questionTypeId },
  });
  const schema = qt.adminFieldSchema as AdminFieldSchema;
  const errors = validateQuestionPayload(schema, promptContent, correctAnswer);
  if (qt.isScored && !correctAnswer) {
    const needsAnswer = schema.fields.some(
      (f) => f.target === "answer" || (f.type === "options" && f.withCorrect),
    );
    if (needsAnswer) errors.push("Este tipo de pregunta se califica: falta la respuesta correcta.");
  }
  return { qt, errors };
}

export async function createQuestion(
  input: z.infer<typeof questionInput>,
): Promise<ActionResult> {
  try {
    await requireAdmin();
    const data = questionInput.parse(input);
    const { errors } = await validateAgainstType(
      data.questionTypeId,
      data.promptContent,
      data.correctAnswer,
    );
    if (errors.length) return { ok: false, error: errors.join(" · ") };

    const last = await prisma.question.aggregate({
      where: { examVersionId: data.examVersionId },
      _max: { order: true },
    });

    await prisma.question.create({
      data: {
        examVersionId: data.examVersionId,
        questionTypeId: data.questionTypeId,
        promptContent: data.promptContent as Prisma.InputJsonValue,
        correctAnswer: (data.correctAnswer ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        feedbackText: data.feedbackText,
        difficultyLevel: data.difficultyLevel,
        order: (last._max.order ?? 0) + 1,
      },
    });
    revalidateExam(data.slug);
    return { ok: true };
  } catch (e) {
    return fail(e, "No se pudo crear la pregunta.");
  }
}

export async function updateQuestion(
  id: string,
  input: z.infer<typeof questionInput>,
): Promise<ActionResult> {
  try {
    await requireAdmin();
    const data = questionInput.parse(input);
    const { errors } = await validateAgainstType(
      data.questionTypeId,
      data.promptContent,
      data.correctAnswer,
    );
    if (errors.length) return { ok: false, error: errors.join(" · ") };

    await prisma.question.update({
      where: { id },
      data: {
        promptContent: data.promptContent as Prisma.InputJsonValue,
        correctAnswer: (data.correctAnswer ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        feedbackText: data.feedbackText,
        difficultyLevel: data.difficultyLevel,
      },
    });
    revalidateExam(data.slug);
    return { ok: true };
  } catch (e) {
    return fail(e, "No se pudo actualizar la pregunta.");
  }
}

export async function deleteQuestion(id: string, slug: string): Promise<ActionResult> {
  try {
    await requireAdmin();
    await prisma.question.delete({ where: { id } });
    revalidateExam(slug);
    return { ok: true };
  } catch (e) {
    return fail(e, "No se pudo eliminar la pregunta.");
  }
}

/* ═══════════════ Carga masiva (bulk) ═══════════════
 * Formato documentado en docs/carga-masiva.md:
 * { "questions": [ { "questionType": "<nombre exacto>",
 *   "prompt": {...}, "answer": {...} | null,
 *   "feedback"?: string, "difficulty"?: 1-5 } ] }
 */

const bulkItemZ = z.object({
  questionType: z.string().min(1),
  prompt: z.record(z.string(), z.unknown()),
  answer: z.record(z.string(), z.unknown()).nullable().optional(),
  feedback: z.string().optional(),
  difficulty: z.number().int().min(1).max(5).optional(),
});

const bulkPayloadZ = z.union([
  z.object({ questions: z.array(bulkItemZ).min(1) }),
  z.array(bulkItemZ).min(1),
]);

export async function bulkCreateQuestions(input: {
  slug: string;
  examVersionId: string;
  json: string;
}): Promise<ActionResult<{ created: number; errors: string[] }>> {
  try {
    await requireAdmin();

    let raw: unknown;
    try {
      raw = JSON.parse(input.json);
    } catch {
      return { ok: false, error: "El contenido no es JSON válido." };
    }
    const parsed = bulkPayloadZ.parse(raw);
    const items = Array.isArray(parsed) ? parsed : parsed.questions;

    const version = await prisma.examVersion.findUniqueOrThrow({
      where: { id: input.examVersionId },
      include: {
        examType: {
          include: { sections: { include: { questionTypes: true } } },
        },
      },
    });
    const typesByName = new Map(
      version.examType.sections
        .flatMap((s) => s.questionTypes)
        .map((qt) => [qt.name.toLowerCase(), qt]),
    );

    const errors: string[] = [];
    const valid: {
      questionTypeId: string;
      promptContent: Record<string, unknown>;
      correctAnswer: Record<string, unknown> | null;
      feedbackText: string | null;
      difficultyLevel: number | null;
    }[] = [];

    items.forEach((item, i) => {
      const qt = typesByName.get(item.questionType.toLowerCase());
      if (!qt) {
        errors.push(`#${i + 1}: tipo de pregunta "${item.questionType}" no existe en este examen.`);
        return;
      }
      const schema = qt.adminFieldSchema as AdminFieldSchema;
      const answer = item.answer ?? null;
      const payloadErrors = validateQuestionPayload(schema, item.prompt, answer);
      if (payloadErrors.length) {
        errors.push(`#${i + 1} (${qt.name}): ${payloadErrors.join(" · ")}`);
        return;
      }
      valid.push({
        questionTypeId: qt.id,
        promptContent: item.prompt,
        correctAnswer: answer,
        feedbackText: item.feedback ?? null,
        difficultyLevel: item.difficulty ?? null,
      });
    });

    if (errors.length) {
      return { ok: false, error: `Nada se importó. Errores:\n${errors.join("\n")}` };
    }

    const last = await prisma.question.aggregate({
      where: { examVersionId: input.examVersionId },
      _max: { order: true },
    });
    let order = last._max.order ?? 0;

    await prisma.question.createMany({
      data: valid.map((v) => ({
        examVersionId: input.examVersionId,
        questionTypeId: v.questionTypeId,
        promptContent: v.promptContent as Prisma.InputJsonValue,
        correctAnswer: (v.correctAnswer ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        feedbackText: v.feedbackText,
        difficultyLevel: v.difficultyLevel,
        order: ++order,
      })),
    });

    revalidateExam(input.slug);
    return { ok: true, data: { created: valid.length, errors: [] } };
  } catch (e) {
    return fail(e, "No se pudo procesar la carga masiva.");
  }
}
