"use server";

import { cookies } from "next/headers";
import { getServerSession } from "next-auth";
import { Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { gradeAttempt } from "@/lib/grading";
import { z } from "zod";
import { createHmac, timingSafeEqual } from "node:crypto";
import { advanceRuntime, beginSpokenResponse, jumpRuntime, previousRuntime, runtimeView, type RuntimeView } from "@/lib/attempt-runtime";
import { closedPoints } from "@/lib/toefl-delivery";
import { detMetadata, detPoints } from "@/lib/det-format";
import { activeAttempt, AttemptError, writeAnswer } from "./attempt-service";

export type StudentActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

async function requireStudent() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "STUDENT") {
    throw new Error("No autorizado");
  }
  return session;
}

function accessCookieName(enrollmentId: string) {
  return `exam_access_${enrollmentId}`;
}

function accessToken(enrollment: { id: string; studentId: string; accessCode: string }) {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("NEXTAUTH_SECRET no está configurado.");
  return createHmac("sha256", secret)
    .update(JSON.stringify([enrollment.id, enrollment.studentId, enrollment.accessCode]))
    .digest("hex");
}

async function validAccessCookie(enrollment: { id: string; studentId: string; accessCode: string }) {
  const actual = (await cookies()).get(accessCookieName(enrollment.id))?.value ?? "";
  const expected = accessToken(enrollment);
  return actual.length === expected.length && timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
}

function actionError(error: unknown, fallback: string): { ok: false; error: string } {
  if (error instanceof AttemptError) return { ok: false, error: error.message };
  if (error instanceof z.ZodError) return { ok: false, error: "La respuesta enviada no es válida." };
  console.error(fallback, error);
  return { ok: false, error: fallback };
}

const answerInput = z.object({
  attemptId: z.string().min(1).max(200),
  questionId: z.string().min(1).max(200),
  answerContent: z.record(z.string(), z.unknown()),
  isFlagged: z.boolean(),
});

/* ─────────── Verificación del código de acceso ───────────
 * Al validar, se guarda una cookie httpOnly de sesión de examen
 * para no pedir el código en cada visita (8 horas).
 */
export async function verifyAccessCode(input: {
  slug: string;
  code: string;
}): Promise<StudentActionResult> {
  try {
    const session = await requireStudent();
    const enrollment = await prisma.enrollment.findFirst({
      where: {
        studentId: session.user.id,
        examType: { slug: input.slug },
      },
    });
    if (!enrollment) return { ok: false, error: "No tienes acceso a este examen." };
    if (enrollment.isBlocked) {
      return { ok: false, error: "Tu acceso a este examen está bloqueado. Contacta a tu asesor." };
    }

    const normalized = input.code.toUpperCase().replace(/[^A-Z0-9]/g, "");
    const expected = enrollment.accessCode.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (normalized !== expected) {
      return { ok: false, error: "Código incorrecto. Revísalo con tu asesor." };
    }

    (await cookies()).set(accessCookieName(enrollment.id), accessToken(enrollment), {
      httpOnly: true,
      sameSite: "lax",
      path: "/alumno",
      maxAge: 60 * 60 * 8,
      secure: process.env.NEXTAUTH_URL?.startsWith("https://") === true,
    });
    return { ok: true };
  } catch (e) {
    console.error("verifyAccessCode", e);
    return { ok: false, error: "No se pudo verificar el código." };
  }
}

export async function hasExamAccess(enrollmentId: string): Promise<boolean> {
  const session = await requireStudent();
  const enrollment = await prisma.enrollment.findUnique({ where: { id: enrollmentId } });
  return !!enrollment && enrollment.studentId === session.user.id && !enrollment.isBlocked && validAccessCookie(enrollment);
}

/* ─────────── Iniciar (o retomar) un intento ─────────── */
export async function startAttempt(input: {
  examVersionId: string;
}): Promise<StudentActionResult<{ attemptId: string; resumed: boolean }>> {
  try {
    const session = await requireStudent();

    const version = await prisma.examVersion.findUnique({
      where: { id: input.examVersionId },
      include: { examType: { select: { id: true } } },
    });
    if (!version || !version.isPublished) {
      return { ok: false, error: "Esta versión no está disponible." };
    }

    const enrollment = await prisma.enrollment.findUnique({
      where: {
        studentId_examTypeId: {
          studentId: session.user.id,
          examTypeId: version.examType.id,
        },
      },
    });
    if (!enrollment || enrollment.isBlocked) {
      return { ok: false, error: "No tienes acceso a este examen." };
    }
    if (!(await validAccessCookie(enrollment))) {
      return { ok: false, error: "Ingresa primero tu código de acceso." };
    }
    if (!enrollment.unlockedVersions.includes(version.id)) {
      return { ok: false, error: "Esta versión aún no está desbloqueada para ti." };
    }

    const result = await prisma.$transaction(async (tx) => {
      // Lock the enrollment before checking quota and existing attempts.
      await tx.$queryRaw`SELECT "id" FROM "Enrollment" WHERE "id" = ${enrollment.id} FOR UPDATE`;
      const current = await tx.enrollment.findUniqueOrThrow({ where: { id: enrollment.id } });
      if (current.isBlocked || !current.unlockedVersions.includes(version.id)) {
        throw new AttemptError("Tu acceso a esta versión no está disponible.");
      }
      const existing = await tx.attempt.findFirst({
        where: { studentId: session.user.id, examVersionId: version.id, status: "IN_PROGRESS" },
      });
      if (existing) return { attemptId: existing.id, resumed: true };
      if (current.attemptsUsed >= current.attemptsAllowed) {
        throw new AttemptError("Ya usaste todos tus intentos de este examen.");
      }
      if (!(await tx.question.count({ where: { examVersionId: version.id } }))) {
        throw new AttemptError("Esta versión todavía no tiene preguntas.");
      }
      const created = await tx.attempt.create({
        data: { studentId: session.user.id, examVersionId: version.id },
      });
      await tx.enrollment.update({
        where: { id: enrollment.id },
        data: { attemptsUsed: { increment: 1 } },
      });
      await activeAttempt(tx, created.id, session.user.id);
      return { attemptId: created.id, resumed: false };
    });

    return { ok: true, data: result };
  } catch (e) {
    return actionError(e, "No se pudo iniciar el intento.");
  }
}

/* ─────────── Guardar respuesta (una por pregunta) ─────────── */
export async function saveResponse(input: {
  attemptId: string;
  questionId: string;
  answerContent: Record<string, unknown>;
  isFlagged: boolean;
}): Promise<StudentActionResult> {
  try {
    const session = await requireStudent();
    const data = answerInput.parse(input);
    await prisma.$transaction(async (tx) => {
      const { questions, state } = await activeAttempt(tx, data.attemptId, session.user.id);
      if (state.finished || questions[state.index].id !== data.questionId) {
        throw new AttemptError("Esta pregunta ya no está activa. Recarga para sincronizar tu intento.");
      }
      if (Date.now() >= state.deadlineAt) throw new AttemptError("El tiempo de esta pregunta o sección terminó.");
      if (detMetadata(questions[state.index].promptContent) && state.phase !== "answer") throw new AttemptError("La respuesta todavía no ha comenzado.");
      await writeAnswer(tx, data.attemptId, data.questionId, data.answerContent, data.isFlagged);
    });
    return { ok: true };
  } catch (e) {
    return actionError(e, "No se pudo guardar la respuesta. Tu respuesta sigue en esta pantalla; reintenta.");
  }
}

export async function getAttemptProgress(attemptId: string): Promise<StudentActionResult<RuntimeView>> {
  try {
    const session = await requireStudent();
    const state = await prisma.$transaction(async (tx) =>
      (await activeAttempt(tx, attemptId, session.user.id)).state,
    );
    return { ok: true, data: runtimeView(state) };
  } catch (e) {
    return actionError(e, "No se pudo recuperar el avance del examen.");
  }
}

export async function beginSpeaking(input: { attemptId: string; questionId: string }): Promise<StudentActionResult<RuntimeView>> {
  try {
    const session = await requireStudent();
    const state = await prisma.$transaction(async (tx) => {
      const context = await activeAttempt(tx, input.attemptId, session.user.id);
      if (context.questions[context.state.index].id !== input.questionId) throw new AttemptError("Esta pregunta ya no está activa.");
      if (context.timedQuestions[context.state.index].det?.task === "interview" && context.state.phase === "stimulus" && !(context.state.audioPlays[input.questionId] > 0)) throw new AttemptError("Escucha primero la pregunta de la conversación.");
      const next = beginSpokenResponse(context.state, context.timedQuestions, Date.now());
      await tx.attempt.update({ where: { id: input.attemptId }, data: { runtimeState: next as Prisma.InputJsonValue } });
      return next;
    });
    return { ok: true, data: runtimeView(state) };
  } catch (e) { return actionError(e, "No se pudo iniciar el tiempo de respuesta."); }
}

/** Save and move atomically: a failed save can never skip a question. */
export async function navigateAttempt(
  input: z.infer<typeof answerInput> & { direction: "next" | "previous" },
): Promise<StudentActionResult<RuntimeView>> {
  try {
    const session = await requireStudent();
    const data = answerInput.extend({ direction: z.enum(["next", "previous"]) }).parse(input);
    const state = await prisma.$transaction(async (tx) => {
      const context = await activeAttempt(tx, data.attemptId, session.user.id);
      const { state, questions, timedQuestions, attempt } = context;
      // Navigation retries are idempotent, and stale tabs cannot advance twice.
      if (state.finished || questions[state.index].id !== data.questionId) return state;
      const now = Date.now();
      if (state.phase !== "answer" && now < state.deadlineAt) throw new AttemptError("Completa primero la preparación o escucha la consigna.");
      // Small transport grace for a final answer already on its way. The deadline never changes.
      if (now <= state.deadlineAt + 5000) {
        await writeAnswer(tx, data.attemptId, data.questionId, data.answerContent, data.isFlagged);
      }
      const theme = attempt.examVersion.examType.themeConfig as { navigation?: { allowBack?: boolean } };
      const stored = new Map(context.attempt.responses.map((response) => [response.questionId, response.answerContent as Record<string, unknown>]));
      if (now <= state.deadlineAt + 5000) stored.set(data.questionId, data.answerContent);
      const earned = Object.fromEntries(questions.map((q) => [q.id, detMetadata(q.promptContent) ? detPoints(q.promptContent as Record<string, unknown>, q.correctAnswer as Record<string, unknown> | null, stored.get(q.id)).earned : closedPoints({ responseType: q.questionType.responseType,
        promptContent: q.promptContent as Record<string, unknown>, correctAnswer: q.correctAnswer as Record<string, unknown> | null }, stored.get(q.id)).earned]));
      const next = data.direction === "previous"
        ? previousRuntime(state, timedQuestions, theme.navigation?.allowBack === true &&
            ((attempt.examVersion.examType.themeConfig as { examInterface?: string }).examInterface !== "toefl" ||
              questions[state.index].questionType.section.name === "Reading"), now)
        : advanceRuntime(state, timedQuestions, now, earned);
      await tx.attempt.update({ where: { id: data.attemptId }, data: { runtimeState: next as Prisma.InputJsonValue } });
      return next;
    });
    return { ok: true, data: runtimeView(state) };
  } catch (e) {
    return actionError(e, "No se pudo guardar el avance. Reintenta sin cerrar esta pantalla.");
  }
}

export async function reviewAttemptQuestion(input: z.infer<typeof answerInput> & { targetQuestionId: string }): Promise<StudentActionResult<RuntimeView>> {
  try {
    const session = await requireStudent();
    const data = answerInput.extend({ targetQuestionId: z.string().min(1).max(200) }).parse(input);
    const state = await prisma.$transaction(async (tx) => {
      const context = await activeAttempt(tx, data.attemptId, session.user.id);
      const current = context.questions[context.state.index];
      if (current.id !== data.questionId || current.questionType.section.name !== "Reading") throw new AttemptError("La revisión solo está disponible en el módulo de Reading activo.");
      const next = jumpRuntime(context.state, context.timedQuestions, data.targetQuestionId, Date.now());
      await writeAnswer(tx, data.attemptId, data.questionId, data.answerContent, data.isFlagged);
      await tx.attempt.update({ where: { id: data.attemptId }, data: { runtimeState: next as Prisma.InputJsonValue } });
      return next;
    });
    return { ok: true, data: runtimeView(state) };
  } catch (e) { return actionError(e, "No se pudo abrir la pregunta de revisión."); }
}

export async function markAudioPlayed(input: { attemptId: string; questionId: string }): Promise<StudentActionResult> {
  try {
    const session = await requireStudent();
    const data = z.object({ attemptId: z.string().min(1), questionId: z.string().min(1) }).parse(input);
    await prisma.$transaction(async (tx) => {
      const { questions, state } = await activeAttempt(tx, data.attemptId, session.user.id);
      const question = questions[state.index];
      if (question.id !== data.questionId || state.finished || Date.now() >= state.deadlineAt) throw new AttemptError("Esta pregunta ya no está activa.");
      const audio = (question.promptContent as Record<string, unknown>).audioUrl;
      if (typeof audio !== "string") throw new AttemptError("Esta pregunta no contiene un audio.");
      const det = detMetadata(question.promptContent);
      const count = state.audioPlays[question.id] ?? 0;
      const limit = det ? det.task === "dictation" ? 3 : det.task === "listen-complete" ? Infinity : 1 : Infinity;
      if (count >= limit) throw new AttemptError("Ya utilizaste las reproducciones disponibles.");
      const next = { ...state, playedAudio: [...new Set([...state.playedAudio, audio])], audioPlays: { ...state.audioPlays, [question.id]: count + 1 } };
      await tx.attempt.update({ where: { id: data.attemptId }, data: { runtimeState: next as Prisma.InputJsonValue } });
    });
    return { ok: true };
  } catch (e) { return actionError(e, "No se pudo registrar la reproducción del audio."); }
}

/* ─────────── Completar intento ───────────
 * Auto-califica cerradas, calcula score/subscores y decide
 * COMPLETED vs PENDING_REVIEW (+ notificación al admin).
 */
export async function completeAttempt(input: {
  attemptId: string;
}): Promise<StudentActionResult> {
  try {
    const session = await requireStudent();
    await prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<{ id: string }[]>`
        SELECT "id" FROM "Attempt" WHERE "id" = ${input.attemptId}
        AND "studentId" = ${session.user.id} FOR UPDATE
      `;
      if (!locked.length) throw new AttemptError("Intento no encontrado.");
      const attempt = await tx.attempt.findUniqueOrThrow({ where: { id: input.attemptId }, select: { status: true } });
      if (attempt.status !== "IN_PROGRESS") return;
      const { state } = await activeAttempt(tx, input.attemptId, session.user.id);
      if (!state.finished) throw new AttemptError("Completa el recorrido del examen antes de enviarlo.");
      await gradeAttempt(tx, input.attemptId, { autoGrade: true });
    });
    return { ok: true };
  } catch (e) {
    return actionError(e, "No se pudo enviar el examen.");
  }
}
