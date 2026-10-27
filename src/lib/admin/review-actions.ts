"use server";

import { revalidatePath } from "next/cache";
import { getAppSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { gradeAttempt } from "@/lib/grading";
import type { ActionResult } from "./actions";
import { z } from "zod";
import { deliveryMetadata } from "@/lib/toefl-delivery";
import { RUBRIC_VERSION, toeflRubrics } from "@/lib/toefl-rubrics";
import { detMetadata, detRubric, detListeningRubric, DET_RUBRIC_VERSION } from "@/lib/det-format";
import { queueAttemptEmails, scheduleEmails } from "@/lib/email";
import { canReviewStudent } from "@/lib/teacher/scope";

async function requireAdmin() {
  const session = await getAppSession();
  if (!session || !["ADMIN", "TEACHER"].includes(session.user.role)) {
    throw new Error("No autorizado");
  }
  return session;
}

/*
 * Revisión manual de una respuesta abierta (writing/speaking).
 * - Tipos calificables: verdict "correct" | "incorrect" entra al score.
 * - Tipos isScored=false (Writing/Speaking Sample): verdict "reviewed"
 *   solo la marca revisada; nunca afecta el score.
 * Al quedar todas revisadas, el intento pasa a COMPLETED, se recalculan
 * scores y las notificaciones se marcan leídas.
 */
export async function reviewResponse(input: {
  responseId: string;
  verdict: "correct" | "incorrect" | "reviewed";
  reviewNotes: string;
  rubricScore?: number;
}): Promise<ActionResult<{ attemptStatus: string }>> {
  try {
    const session = await requireAdmin();

    const data = z.object({ responseId: z.string().min(1), verdict: z.enum(["correct", "incorrect", "reviewed"]), reviewNotes: z.string().max(10000), rubricScore: z.number().int().min(0).max(5).optional() }).parse(input);
    const response = await prisma.response.findUnique({
      where: { id: input.responseId },
      include: { attempt: { select: { id: true, status: true, studentId: true } }, question: { include: { questionType: true } } },
    });
    if (!response) return { ok: false, error: "Respuesta no encontrada." };
    if (!await canReviewStudent(prisma, session.user, response.attempt.studentId)) return { ok: false, error: "No tienes acceso a esta revisión." };
    if (response.attempt.status === "IN_PROGRESS") return { ok: false, error: "Espera a que el alumno envíe el intento." };
    const det = detMetadata(response.question.promptContent);
    if (!["FREE_TEXT", "AUDIO_RECORDING"].includes(response.question.questionType.responseType) && det?.task!=="listen-complete") return { ok: false, error: "Esta respuesta no requiere revisión manual." };
    const rubric = det ? det.task==="listen-complete"?detListeningRubric:detRubric : deliveryMetadata(response.question.promptContent) && toeflRubrics[response.question.questionType.name];
    if (rubric && data.rubricScore === undefined) return { ok: false, error: "Selecciona una puntuación de rúbrica entre 0 y 5." };

    const { status } = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "Student" WHERE "id" = ${response.attempt.studentId} FOR SHARE`;
    if (!await canReviewStudent(tx, session.user, response.attempt.studentId)) throw new Error("No autorizado.");
    await tx.$queryRaw`SELECT "id" FROM "Attempt" WHERE "id" = ${response.attempt.id} FOR UPDATE`;
    await tx.response.update({
      where: { id: input.responseId },
      data: {
        isCorrect: rubric ? data.rubricScore! >= 3 : data.verdict !== "incorrect",
        reviewNotes: data.reviewNotes.trim() || null,
        ...(rubric ? { reviewAssessment: { version: det ? DET_RUBRIC_VERSION : RUBRIC_VERSION, task: response.question.questionType.name, score: data.rubricScore!, source: "teacher" } } : {}),
      },
    });

    const result = await gradeAttempt(tx, response.attempt.id, {
      autoGrade: false,
    });
    if (result.status === "COMPLETED") await queueAttemptEmails(tx, response.attempt.id, "reviewed");
    return result;
    }, { timeout: 20000 });

    revalidatePath(`/admin/revision/${response.attempt.id}`);
    revalidatePath("/admin/metricas");
    revalidatePath("/profesor", "layout");
    revalidatePath(`/alumno/resultado/${response.attempt.id}`);
    scheduleEmails();
    return { ok: true, data: { attemptStatus: status } };
  } catch (e) {
    console.error("reviewResponse", e);
    return { ok: false, error: "No se pudo guardar la revisión." };
  }
}
