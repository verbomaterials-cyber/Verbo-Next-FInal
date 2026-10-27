import { Prisma, PrismaClient } from "@prisma/client";
import { readFile } from "node:fs/promises";
import { toeflForm } from "../content/toefl-2026/forms";
import { deliveryMetadata } from "../src/lib/toefl-delivery";
import { validateQuestionPayload, type AdminFieldSchema } from "../src/lib/exam-config";
const url = new URL(process.env.DATABASE_URL ?? "");
if (url.hostname !== "127.0.0.1" || url.port !== "54329" || url.pathname !== "/verbo_next") throw new Error("Solo se admite la base local verbo_next.");
const db = new PrismaClient();
const selected = toeflForm(process.argv.find((arg) => arg.startsWith("--form="))?.split("=")[1] ?? "1");
const { data: form, audioScripts } = selected;
async function main() {
try {
  const exam = await db.examType.findUniqueOrThrow({ where: { slug: "toefl-ibt" }, include: { sections: { include: { questionTypes: true } } } });
  const version = await db.examVersion.findFirstOrThrow({ where: { examTypeId: exam.id, label: selected.label }, include: { _count: { select: { questions: true, attempts: true } } } });
  const types = exam.sections.flatMap((s) => s.questionTypes);
  for (const question of form.questions) {
    const type = types.find((t) => t.name === question.questionType);
    if (!type) throw new Error(`Tipo no encontrado: ${question.questionType}`);
    const errors = validateQuestionPayload(type.adminFieldSchema as AdminFieldSchema, question.prompt, question.answer);
    if (errors.length) throw new Error(`${question.key}: ${errors.join("; ")}`);
    if (!deliveryMetadata(question.prompt)) throw new Error("Faltan metadatos de entrega.");
  }
  for (const audio of audioScripts) {
    const wav = await readFile(`public/audio/toefl-2026/form-${selected.number}/${audio.id}.wav`);
    if (wav.toString("ascii", 0, 4) !== "RIFF" || wav.toString("ascii", 8, 12) !== "WAVE" || wav.length < 1000) throw new Error(`Audio inválido: ${audio.id}`);
  }
  const safe = version._count.questions === 0 && version._count.attempts === 0;
  console.log(JSON.stringify({ target: `local / TOEFL / ${selected.label}`, formId: form.formId, questionRecords: form.questions.length,
    deliveredItems: 120, audioFiles: audioScripts.length, existing: version._count, canInstall: safe,
    preserves: "Diagnóstico, otras versiones, cuentas e intentos existentes", publishAfterInstall: true }, null, 2));
  if (process.argv.includes("--apply")) {
    if (!safe) throw new Error("La versión contiene preguntas o intentos: no se sustituye contenido existente.");
    await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "ExamVersion" WHERE "id" = ${version.id} FOR UPDATE`;
      if (await tx.question.count({ where: { examVersionId: version.id } }) || await tx.attempt.count({ where: { examVersionId: version.id } })) throw new Error("La versión cambió durante la instalación.");
      await tx.question.createMany({ data: form.questions.map((q, index) => ({ questionTypeId: types.find((t) => t.name === q.questionType)!.id,
        examVersionId: version.id, promptContent: JSON.parse(JSON.stringify(q.prompt)) as Prisma.InputJsonValue,
        correctAnswer: q.answer ? q.answer as Prisma.InputJsonValue : Prisma.DbNull, feedbackText: q.feedback, difficultyLevel: q.difficulty, order: index + 1 })) });
      await tx.examVersion.update({ where: { id: version.id }, data: { isPublished: true, hasFeedback: true } });
      // Only the known demo student's access is extended. Real enrollments stay under admin control.
      const demo = await tx.enrollment.findFirst({ where: { examTypeId: exam.id, student: { email: "alumno@verbo.local" } } });
      if (demo && !demo.unlockedVersions.includes(version.id)) await tx.enrollment.update({ where: { id: demo.id }, data: { unlockedVersions: { push: version.id } } });
    }, { timeout: 20000 });
    console.log(`${selected.label} instalado y publicado localmente; otras versiones e intentos conservados.`);
  }
} finally { await db.$disconnect(); }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
