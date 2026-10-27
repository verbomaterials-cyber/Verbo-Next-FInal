import { Prisma, PrismaClient } from "@prisma/client";
import { randomBytes } from "node:crypto";
import { readFile, writeFile, unlink } from "node:fs/promises";
import bcrypt from "bcryptjs";
import { activeAttempt } from "../src/lib/student/attempt-service";
import { gradeAttempt } from "../src/lib/grading";
const file = ".local/toefl/browser-test.json";
const url = new URL(process.env.DATABASE_URL ?? "");
if (url.hostname !== "127.0.0.1" || url.port !== "54329" || url.pathname !== "/verbo_next") throw new Error("Solo se admite la base local de prueba.");
const db = new PrismaClient();
async function main() {
try {
  if (process.argv.includes("--review")) {
    const access = JSON.parse(await readFile(file, "utf8"));
    const attempt = await db.attempt.findUniqueOrThrow({ where: { id: access.attemptId }, include: { student: true } });
    if (attempt.studentId !== access.studentId || attempt.student.email !== access.email || !access.email.startsWith("browser-verify-")) throw new Error("No es el intento temporal esperado.");
    const question = await db.question.findFirstOrThrow({ where: { examVersionId: attempt.examVersionId, questionType: { name: "Write an Email" } } });
    await db.response.upsert({ where: { attemptId_questionId: { attemptId: attempt.id, questionId: question.id } },
      create: { attemptId: attempt.id, questionId: question.id, answerContent: { text: "Dear Dr. Rivera, Thank you for organizing the preparation meeting. Unfortunately, I have a laboratory class on Friday afternoon and attendance is compulsory. I would still like to prepare properly for the field course, especially the safety procedures and the equipment we need to bring. Would it be possible to watch a recording of the meeting and send you any questions afterward? Alternatively, I could meet you during your office hours on Thursday. Please let me know which option would work best. Kind regards, Alex" } }, update: {} });
    await db.attempt.update({ where: { id: attempt.id }, data: { runtimeState: { ...(attempt.runtimeState as Prisma.JsonObject), finished: true } } });
    await gradeAttempt(db, attempt.id, { autoGrade: true });
    console.log("Solo el intento temporal quedó preparado para comprobar la revisión del profesor."); return;
  }
  if (process.argv.includes("--cleanup")) {
    const access = JSON.parse(await readFile(file, "utf8"));
    const student = await db.student.findUnique({ where: { id: access.studentId } });
    if (!student || student.email !== access.email || !student.email.startsWith("browser-verify-") || !student.email.endsWith("@verbo.local")) throw new Error("No es el alumno temporal esperado.");
    const attempts = await db.attempt.findMany({ where: { studentId: student.id }, select: { id: true } });
    await db.notification.deleteMany({ where: { attemptId: { in: attempts.map((a) => a.id) } } });
    await db.student.delete({ where: { id: student.id } });
    await unlink(file);
    console.log("Solo los registros de la prueba visual fueron eliminados."); return;
  }
  try { await readFile(file); throw new Error("Existe una prueba visual pendiente de limpiar."); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  if (process.argv.includes("--progress")) {
    const versions = await db.examVersion.findMany({ where: { label: { in: ["Simulador 2", "Simulador 3"] }, isPublished: true, examType: { slug: "toefl-ibt" } }, orderBy: { label: "asc" } });
    if (versions.length !== 2) throw new Error("Faltan los simuladores publicados para la prueba.");
    const email = `browser-verify-${randomBytes(6).toString("hex")}@verbo.local`, password = randomBytes(16).toString("base64url"), code = randomBytes(6).toString("hex");
    const hash = await bcrypt.hash(password, 10);
    const student = await db.$transaction(async (tx) => {
      const student = await tx.student.create({ data: { fullName: "Comparación temporal de prueba", email, passwordHash: hash } });
      await tx.enrollment.create({ data: { studentId: student.id, examTypeId: versions[0].examTypeId, accessCode: code, unlockedVersions: versions.map((v) => v.id), attemptsAllowed: 20, attemptsUsed: 3 } });
      for (const [index, earned] of [[0, [18, 20, 12, 30]], [1, [26, 27, 16, 42]], [2, [28, 29, 0, 0]]] as const) {
        const possible = [35, 35, 20, 55];
        const names = ["Reading", "Listening", "Writing", "Speaking"];
        const pending = index === 2;
        const raw = Object.fromEntries(names.map((name, i) => [name, { earned: earned[i], possible: possible[i], pending: pending && i >= 2 ? 1 : 0 }]));
        const value = pending ? null : Math.round(earned.map((points, i) => Math.round((1 + 5 * points / possible[i]) * 2) / 2).reduce((a, b) => a + b, 0) / 4 * 2) / 2;
        const when = new Date(Date.now() - (3 - index) * 86400000);
        const routes = { Reading: { branch: "upper", earned: 18, possible: 20, threshold: .65 }, Listening: { branch: "upper", earned: 18, possible: 20, threshold: .65 } };
        await tx.attempt.create({ data: { studentId: student.id, examVersionId: versions[index === 0 ? 0 : 1].id,
          startedAt: when, completedAt: when, status: pending ? "PENDING_REVIEW" : "COMPLETED",
          runtimeState: { routes }, overallScore: { scoringVersion: "verbo-toefl-practice-v1", calibrated: false, value, raw, routes, fixture: true } } });
      }
      return student;
    });
    await writeFile(file, JSON.stringify({ studentId: student.id, email, password, code, url: "http://localhost:3000/alumno/progreso/toefl-ibt", fixture: "synthetic-progress-only" }), { mode: 0o600 });
    console.log("Comparación preparada con dos resultados evaluados y uno pendiente, todos sintéticos y desechables."); return;
  }
  const version = await db.examVersion.findFirstOrThrow({ where: { label: "Simulador 1", examType: { slug: "toefl-ibt" } } });
  const password = randomBytes(16).toString("base64url");
  const email = `browser-verify-${randomBytes(6).toString("hex")}@verbo.local`;
  const student = await db.student.create({ data: { fullName: "Prueba visual temporal", email, passwordHash: await bcrypt.hash(password, 10) } });
  const code = randomBytes(6).toString("hex");
  const attempt = await db.$transaction(async (tx) => {
    await tx.enrollment.create({ data: { studentId: student.id, examTypeId: version.examTypeId, accessCode: code, unlockedVersions: [version.id], attemptsAllowed: 2, attemptsUsed: 1 } });
    const attempt = await tx.attempt.create({ data: { studentId: student.id, examVersionId: version.id } });
    const context = await activeAttempt(tx, attempt.id, student.id);
    const last = context.timedQuestions.findLastIndex((q) => q.delivery?.section === "Reading" && q.delivery.module === "router");
    for (const q of context.questions.slice(0, last + 1)) await tx.response.create({ data: { attemptId: attempt.id, questionId: q.id, answerContent: q.correctAnswer as Prisma.InputJsonValue } });
    await tx.attempt.update({ where: { id: attempt.id }, data: { runtimeState: { ...context.state, index: last, maxIndex: last } as Prisma.InputJsonValue } });
    return attempt;
  });
  await writeFile(file, JSON.stringify({ studentId: student.id, email, password, code, attemptId: attempt.id, url: `http://127.0.0.1:3000/alumno/intento/${attempt.id}` }), { mode: 0o600 });
  console.log("Prueba visual preparada en el final del primer módulo; credenciales privadas guardadas en .local/toefl/browser-test.json.");
} finally { await db.$disconnect(); }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
