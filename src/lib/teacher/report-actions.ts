"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAppSession } from "@/lib/session";
import { canReviewStudent } from "./scope";
import { readTeacherReport, reportContentZ, reportPublicationError } from "./report";
class ReportInputError extends Error {}

export async function saveTeacherReport(input: unknown) {
  const session = await getAppSession();
  if (!session || !["ADMIN", "TEACHER"].includes(session.user.role)) return { ok: false as const, error: "No autorizado." };
  const parsed = z.object({ attemptId: z.string().min(1), revision: z.number().int().nonnegative(), publish: z.boolean(), content: reportContentZ }).strict().safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Revisa el contenido y la fecha del reporte. Cada campo admite hasta 4000 caracteres y puedes elegir dos prioridades." };
  try {
    const data = parsed.data;
    const revision = await prisma.$transaction(async tx => {
      const owner = await tx.attempt.findUniqueOrThrow({ where: { id: data.attemptId }, select: { studentId: true } });
      await tx.$queryRaw`SELECT "id" FROM "Student" WHERE "id" = ${owner.studentId} FOR SHARE`;
      if (!await canReviewStudent(tx, session.user, owner.studentId)) throw new ReportInputError("No tienes acceso a este alumno.");
      await tx.$queryRaw`SELECT "id" FROM "Attempt" WHERE "id" = ${data.attemptId} FOR UPDATE`;
      const attempt = await tx.attempt.findUniqueOrThrow({ where: { id: data.attemptId } });
      if (attempt.status === "IN_PROGRESS") throw new ReportInputError("Espera a que el alumno envíe el intento.");
      const previous = readTeacherReport(attempt.teacherReport);
      if ((previous?.revision ?? 0) !== data.revision) throw new ReportInputError("El reporte cambió en otra ventana. Recarga para ver la última versión antes de guardar.");
      const error = data.publish ? reportPublicationError(data.content, attempt.status) : null;
      if (error) throw new ReportInputError(error);
      const nextRevision = data.revision + 1;
      const report = { version: 1, revision: nextRevision, draft: data.content,
        published: data.publish ? { content: data.content, authorName: session.user.name ?? "Equipo académico Verbo", publishedAt: new Date().toISOString(), overallScore: attempt.overallScore, subscores: attempt.subscores } : previous?.published ?? null };
      await tx.attempt.update({ where: { id: attempt.id }, data: { teacherReport: report as Prisma.InputJsonValue } });
      return nextRevision;
    });
    revalidatePath(`/profesor/revision/${data.attemptId}`);
    revalidatePath(`/admin/revision/${data.attemptId}`);
    revalidatePath(`/alumno/resultado/${data.attemptId}`);
    return { ok: true as const, revision };
  } catch (error) {
    return { ok: false as const, error: error instanceof ReportInputError ? error.message : "No se pudo guardar el reporte. Intenta de nuevo." };
  }
}
