import { Prisma } from "@prisma/client";
import { advanceRuntime, beginSpokenResponse, createRuntime, readRuntime, type TimedQuestion } from "../attempt-runtime";
import { detMetadata, detPoints } from "../det-format";
import type { AdminFieldSchema } from "../exam-config";
import { closedPoints, deliveryMetadata, moduleSeconds } from "../toefl-delivery";

export class AttemptError extends Error {}

export async function activeAttempt(
  tx: Prisma.TransactionClient,
  attemptId: string,
  studentId: string,
) {
  // Serialize saves, navigation and completion, including requests from other tabs.
  const rows = await tx.$queryRaw<{ id: string }[]>`
    SELECT "id" FROM "Attempt"
    WHERE "id" = ${attemptId} AND "studentId" = ${studentId} FOR UPDATE
  `;
  if (!rows.length) throw new AttemptError("Intento no encontrado.");
  const attempt = await tx.attempt.findUniqueOrThrow({
    where: { id: attemptId },
    include: {
      responses: true,
      examVersion: {
        include: {
          examType: true,
          questions: { orderBy: { order: "asc" }, include: { questionType: { include: { section: true } } } },
        },
      },
    },
  });
  if (attempt.status !== "IN_PROGRESS") throw new AttemptError("Este intento ya fue enviado.");
  const enrollment = await tx.enrollment.findUnique({
    where: { studentId_examTypeId: { studentId, examTypeId: attempt.examVersion.examTypeId } },
  });
  if (!enrollment || enrollment.isBlocked || !enrollment.unlockedVersions.includes(attempt.examVersionId)) {
    throw new AttemptError("Tu acceso a este examen no está disponible. Contacta a tu asesor.");
  }
  const questions = [...attempt.examVersion.questions].sort((a, b) => {
    const sectionOrder = attempt.examVersion.examType.sectionOrderMode === "FIXED"
      ? (a.questionType.section.order ?? 0) - (b.questionType.section.order ?? 0) : 0;
    return sectionOrder || a.order - b.order || a.id.localeCompare(b.id);
  });
  if (!questions.length) throw new AttemptError("Esta versión todavía no tiene preguntas.");
  const timedQuestions: TimedQuestion[] = questions.map((q) => {
    const delivery = deliveryMetadata(q.promptContent);
    const det = detMetadata(q.promptContent);
    const seconds = delivery && moduleSeconds(delivery);
    return ({
    id: q.id,
    sectionId: q.questionType.sectionId,
    timingMode: det ? det.group ? "PER_SECTION" : "PER_QUESTION" : q.questionType.timingMode,
    timePerItemSeconds: det?.seconds ?? delivery?.responseSeconds ?? q.questionType.timePerItemSeconds,
    prepTimeSeconds: det ? 0 : q.questionType.prepTimeSeconds,
    sectionDurationMinutes: q.questionType.section.durationMinutes,
    timingGroup: det?.group ? { key: det.group.key, durationSeconds: det.group.seconds } : seconds ? { key: `${delivery!.section}-${delivery!.module}`, durationSeconds: seconds } : (q.questionType.adminFieldSchema as AdminFieldSchema).timingGroup,
    requiresStimulus: det?.task === "interview" || (attempt.examVersion.examType.themeConfig as { examInterface?: string }).examInterface === "toefl" &&
      q.questionType.responseType === "AUDIO_RECORDING",
    enforceSectionLimit: (attempt.examVersion.examType.themeConfig as { examInterface?: string }).examInterface === "toefl",
    delivery: delivery ?? undefined,
    det: det ?? undefined,
    possiblePoints: det ? detPoints(q.promptContent as Record<string, unknown>, q.correctAnswer as Record<string, unknown> | null).possible : delivery ? closedPoints({ responseType: q.questionType.responseType, promptContent: q.promptContent as Record<string, unknown>, correctAnswer: q.correctAnswer as Record<string, unknown> | null }, undefined).possible : undefined,
  }); });
  let state = readRuntime(attempt.runtimeState, timedQuestions);
  if (!state) {
    state = createRuntime(timedQuestions, attempt.startedAt.getTime(), attempt.examVersion.examType.totalDurationMinutes);
    // Old attempts only saved on Next; reconstruct their cursor without resetting the clock.
    const responses = new Map(attempt.responses.map((r) => [r.questionId, r]));
    while (!state.finished) {
      const response = responses.get(questions[state.index].id);
      if (!response) break;
      state = advanceRuntime(state, timedQuestions, response.createdAt.getTime());
    }
    await tx.attempt.update({ where: { id: attemptId }, data: { runtimeState: state as Prisma.InputJsonValue } });
  }
  if (state.phase === "prep" && Date.now() >= state.deadlineAt) {
    state = beginSpokenResponse(state, timedQuestions, Date.now());
    await tx.attempt.update({ where: { id: attemptId }, data: { runtimeState: state as Prisma.InputJsonValue } });
  }
  return { attempt, questions, timedQuestions, state };
}

export async function writeAnswer(
  tx: Prisma.TransactionClient,
  attemptId: string,
  questionId: string,
  answerContent: Record<string, unknown>,
  isFlagged: boolean,
) {
  if (answerContent.recorded === true) {
    const recording = await tx.recording.findUnique({
      where: { attemptId_questionId: { attemptId, questionId } },
      select: { id: true, durationSeconds: true },
    });
    if (!recording || answerContent.recordingId !== recording.id) {
      throw new AttemptError("El audio todavía no se ha guardado. Reintenta la subida antes de continuar.");
    }
    answerContent = { recorded: true, recordingId: recording.id, durationSeconds: recording.durationSeconds,
      audioUrl: `/api/intentos/${attemptId}/grabacion/${questionId}` };
  }
  const content = answerContent as Prisma.InputJsonValue;
  await tx.response.upsert({
    where: { attemptId_questionId: { attemptId, questionId } },
    create: { attemptId, questionId, answerContent: content, isFlagged },
    update: { answerContent: content, isFlagged },
  });
}
