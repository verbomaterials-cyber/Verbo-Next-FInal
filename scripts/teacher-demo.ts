import { readFile, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { PrismaClient, type Prisma } from "@prisma/client";
import { productionConnections, productionOrigin } from "./production-target.mjs";
import { delivered, deliveryMetadata, type RouteDecision } from "../src/lib/toefl-delivery";
import { gradeAttempt } from "../src/lib/grading";
import { RUBRIC_VERSION } from "../src/lib/toefl-rubrics";
import { toneWavDataUri } from "../prisma/seed-data/sample-questions";

// Explicit, isolated demonstration data. Never updates existing accounts or attempts.
const official = process.argv.includes("--official");
const local = new URL(process.env.DATABASE_URL ?? "http://localhost");
if (!official && (local.hostname !== "127.0.0.1" || local.pathname !== "/verbo_next")) throw new Error("Only the local database or the pinned --official target is allowed.");
const file = official ? ".local/deploy/teacher-demo-access.json" : ".local/teacher-demo-access.json";
const teacherEmail = "profesor.demo@verbo.test", studentEmail = "alumno.demo@verbo.test";
async function main() {
const db = official ? new PrismaClient({ datasourceUrl: (await productionConnections()).DIRECT_URL }) : new PrismaClient();
try {
  const existing = await db.teacher.findUnique({ where: { email: teacherEmail }, select: { id: true } });
  if (existing) {
    const access = JSON.parse(await readFile(file, "utf8"));
    if (access.teacher.id !== existing.id) throw new Error("The account exists but is not this script's demonstration account.");
    console.log(JSON.stringify({ environment: official ? productionOrigin : "local", result: "existing-demo-preserved", teacherEmail }));
  } else {
    const teacherPassword = randomBytes(15).toString("base64url"), studentPassword = randomBytes(15).toString("base64url");
    const teacherHash = await bcrypt.hash(teacherPassword, 12), studentHash = await bcrypt.hash(studentPassword, 12);
    const version = await db.examVersion.findFirstOrThrow({ where: { label: "Simulador 1", examType: { slug: "toefl-ibt" }, isPublished: true }, include: { questions: { orderBy: { order: "asc" }, include: { questionType: true } } } });
    const routes: Record<string, RouteDecision> = Object.fromEntries(["Reading", "Listening"].map(name => [name, { branch: "upper", earned: 15, possible: 20, threshold: .65 }]));
    const questions = version.questions.filter(q => delivered(deliveryMetadata(q.promptContent), routes));
    const result = await db.$transaction(async tx => {
      for (const email of [teacherEmail, studentEmail]) {
        if (await tx.student.count({ where: { email } }) || await tx.teacher.count({ where: { email } }) || await tx.adminUser.count({ where: { email } })) throw new Error("Demo email already belongs to an account; no account was changed.");
      }
      const teacher = await tx.teacher.create({ data: { fullName: "Profesor de prueba · Verbo", email: teacherEmail, passwordHash: teacherHash } });
      const student = await tx.student.create({ data: { fullName: "Alumno de demostración · datos ficticios", email: studentEmail, passwordHash: studentHash, teacherId: teacher.id, teacherEmail } });
      await tx.enrollment.create({ data: { studentId: student.id, examTypeId: version.examTypeId, accessCode: "DEMO-" + randomBytes(4).toString("hex").toUpperCase(), attemptsAllowed: 4, attemptsUsed: 2, unlockedVersions: [version.id], targetScore: 4.5, weeklyGoal: 3, focusSkills: ["READING", "WRITING"] } });
      const attempts = [];
      for (const pending of [false, true]) {
        const date = new Date(Date.now() - (pending ? 0 : 86400000));
        const attempt = await tx.attempt.create({ data: { studentId: student.id, examVersionId: version.id, status: "PENDING_REVIEW", startedAt: new Date(date.getTime() - 60 * 60000), completedAt: date, runtimeState: { routes, demo: true } } });
        for (let index = 0; index < questions.length; index++) {
          const q = questions[index], meta = deliveryMetadata(q.promptContent)!;
          const prompt = q.promptContent as Record<string, unknown>;
          const correct = q.correctAnswer as Record<string, unknown> | null;
          const open = ["FREE_TEXT", "AUDIO_RECORDING"].includes(q.questionType.responseType);
          let answer: Record<string, unknown> = structuredClone(correct ?? {});
          if (q.questionType.responseType === "FREE_TEXT") answer = { text: "[Demonstration answer] I would choose a small study group because it helps students exchange ideas. For example, classmates can explain difficult concepts and practice together. However, everyone should also spend time reviewing independently." };
          else if (q.questionType.responseType === "AUDIO_RECORDING") {
            const recording = await tx.recording.create({ data: { attemptId: attempt.id, questionId: q.id, mimeType: "audio/wav", durationSeconds: 1, content: Buffer.from(toneWavDataUri(1).split(",")[1], "base64") } });
            answer = { recorded: true, recordingId: recording.id, durationSeconds: 1, audioUrl: `/api/intentos/${attempt.id}/grabacion/${q.id}` };
          } else if ((meta.section === "Reading" && index % 2 === 0) || (meta.section === "Listening" && index % 5 === 0)) {
            if (Array.isArray(answer.answers)) answer.answers = answer.answers.map((value, i) => i % 2 ? value : "example");
            else if (typeof answer.options === "number") answer.options = (answer.options + 1) % ((prompt.options as { options?: unknown[] })?.options?.length || 4);
          }
          await tx.response.create({ data: { attemptId: attempt.id, questionId: q.id, answerContent: answer as Prisma.InputJsonValue, isFlagged: index === 2 || index === 8,
            ...(open && !pending ? { reviewAssessment: { version: RUBRIC_VERSION, task: q.questionType.name, score: meta.section === "Speaking" ? 4 : 3, source: "teacher" }, isCorrect: true, reviewNotes: "Ejemplo ficticio de evaluación. El audio es un tono de prueba; no representa la voz ni el desempeño de un alumno." } : {}) } });
        }
        await gradeAttempt(tx, attempt.id, { autoGrade: true });
        attempts.push({ id: attempt.id, pending });
      }
      return { teacherId: teacher.id, studentId: student.id, attempts };
    }, { timeout: 120000 });
    await writeFile(file, JSON.stringify({ origin: official ? productionOrigin : "http://127.0.0.1:3000", teacher: { id: result.teacherId, email: teacherEmail, password: teacherPassword }, student: { id: result.studentId, email: studentEmail, password: studentPassword }, attempts: result.attempts }, null, 2), { mode: 0o600, flag: "wx" });
    console.log(JSON.stringify({ environment: official ? productionOrigin : "local", result: "created", teacherEmail, studentEmail, attempts: result.attempts, credentials: file }));
  }
} finally { await db.$disconnect(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
