import { Prisma, type PrismaClient } from "@prisma/client";
import { closedPoints, delivered, deliveryMetadata, type RouteDecision } from "./toefl-delivery";
import { autoGradeResponse } from "./grading";
import type { AdminFieldSchema } from "./exam-config";
import { rubricAssessmentZ, RUBRIC_VERSION } from "./toefl-rubrics";

type Question = { id: string; promptContent: Prisma.JsonValue; correctAnswer: Prisma.JsonValue | null;
  questionType: { name: string; responseType: string; isScored: boolean; adminFieldSchema: Prisma.JsonValue } };
type LoadedAttempt = { id: string; runtimeState: Prisma.JsonValue | null; completedAt: Date | null;
  student: { fullName: string }; responses: { id: string; questionId: string; answerContent: Prisma.JsonValue; reviewAssessment: Prisma.JsonValue | null }[];
  examVersion: { label: string; questions: Question[]; examType: { name: string } } };
export async function gradeToeflAttempt(db: PrismaClient | Prisma.TransactionClient, attempt: LoadedAttempt) {
  const routes = (attempt.runtimeState as { routes?: Record<string, RouteDecision> } | null)?.routes ?? {};
  const responses = new Map(attempt.responses.map((r) => [r.questionId, r]));
  const raw: Record<string, { earned: number; possible: number; pending: number }> = Object.fromEntries(
    ["Reading", "Listening", "Writing", "Speaking"].map((name) => [name, { earned: 0, possible: 0, pending: 0 }]));
  const updates: { id: string; correct: boolean; assessment?: Prisma.InputJsonValue }[] = [];
  for (const q of attempt.examVersion.questions) {
    const meta = deliveryMetadata(q.promptContent);
    if (!meta || !delivered(meta, routes)) continue;
    const r = responses.get(q.id);
    const answer = (r?.answerContent ?? {}) as Record<string, unknown>;
    const section = raw[meta.section];
    const open = ["FREE_TEXT", "AUDIO_RECORDING"].includes(q.questionType.responseType);
    if (open) {
      section.possible += 5;
      const existing = rubricAssessmentZ.safeParse(r?.reviewAssessment);
      const empty = q.questionType.responseType === "FREE_TEXT" ? typeof answer.text !== "string" || !answer.text.trim() : answer.recorded !== true;
      if (existing.success && existing.data.task === q.questionType.name) {
        section.earned += existing.data.score;
      } else if (!empty) section.pending++;
      if (r && empty && !existing.success) updates.push({ id: r.id, correct: false, assessment: { version: RUBRIC_VERSION, task: q.questionType.name, score: 0, source: "missing" } });
    } else if (q.questionType.responseType === "DRAG_SELECT") {
      const correct = autoGradeResponse({ responseType: q.questionType.responseType, isScored: true,
        adminFieldSchema: q.questionType.adminFieldSchema as AdminFieldSchema, promptContent: q.promptContent as Record<string, unknown>,
        correctAnswer: q.correctAnswer as Record<string, unknown> | null, answerContent: answer }) === true;
      section.possible++; section.earned += correct ? 1 : 0;
      if (r) updates.push({ id: r.id, correct });
    } else {
      const points = closedPoints({ responseType: q.questionType.responseType, promptContent: q.promptContent as Record<string, unknown>, correctAnswer: q.correctAnswer as Record<string, unknown> | null }, answer);
      section.possible += points.possible; section.earned += points.earned;
      if (r) updates.push({ id: r.id, correct: autoGradeResponse({ responseType: q.questionType.responseType, isScored: true,
        adminFieldSchema: q.questionType.adminFieldSchema as AdminFieldSchema, promptContent: q.promptContent as Record<string, unknown>, correctAnswer: q.correctAnswer as Record<string, unknown> | null, answerContent: answer }) === true });
    }
  }
  // A global timeout can finish before a second-stage route is selected.
  // Unvisited items still belong in the full-form denominator.
  raw.Reading.possible = Math.max(35, raw.Reading.possible);
  raw.Listening.possible = Math.max(35, raw.Listening.possible);
  const pendingCount = Object.values(raw).reduce((total, section) => total + section.pending, 0);
  const subscores = Object.fromEntries(Object.entries(raw).filter(([, s]) => s.pending === 0 && s.possible > 0)
    .map(([name, s]) => [name, Math.round((1 + 5 * s.earned / s.possible) * 2) / 2]));
  const value = Object.keys(subscores).length === 4 ? Math.round(Object.values(subscores).reduce((a, b) => a + b, 0) / 4 * 2) / 2 : null;
  const status = pendingCount > 0 ? "PENDING_REVIEW" as const : "COMPLETED" as const;
  const persist = async (tx: Prisma.TransactionClient) => {
    for (const update of updates) await tx.response.update({ where: { id: update.id }, data: { isCorrect: update.correct, ...(update.assessment ? { reviewAssessment: update.assessment } : {}) } });
    await tx.attempt.update({ where: { id: attempt.id }, data: { status, completedAt: attempt.completedAt ?? new Date(),
      subscores, overallScore: { value, pending: pendingCount > 0, calibrated: false, raw, routes, scoringVersion: "verbo-toefl-practice-v1" } } });
    if (pendingCount > 0) {
      if (!await tx.notification.findFirst({ where: { attemptId: attempt.id, type: "ATTEMPT_PENDING_REVIEW" } })) await tx.notification.create({ data: {
        type: "ATTEMPT_PENDING_REVIEW", attemptId: attempt.id, message: `${attempt.student.fullName} completó ${attempt.examVersion.examType.name} — ${attempt.examVersion.label}: ${pendingCount} respuestas por evaluar con rúbrica.`, payload: { pendingCount } } });
    } else await tx.notification.updateMany({ where: { attemptId: attempt.id, isRead: false }, data: { isRead: true } });
  };
  if ("$transaction" in db) await db.$transaction(persist, { timeout: 15000 }); else await persist(db);
  return { status, pendingCount };
}
