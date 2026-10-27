import { PrismaClient, Prisma } from "@prisma/client";
import { isDeepStrictEqual } from "node:util";
import { toeflForms } from "../content/toefl-2026/forms";
const db = new PrismaClient();
const url = new URL(process.env.DATABASE_URL ?? "");
if (url.hostname !== "127.0.0.1" || url.port !== "54329" || url.pathname !== "/verbo_next") throw new Error("Solo se admite la base local de desarrollo.");
const json = (value: unknown) => JSON.parse(JSON.stringify(value));
async function main() {
try {
  const source = toeflForms[0].data.questions;
  const version = await db.examVersion.findFirstOrThrow({ where: { label: "Simulador 1", examType: { slug: "toefl-ibt" } },
    include: { questions: { orderBy: { order: "asc" }, include: { questionType: true } }, _count: { select: { attempts: true } } } });
  const additions: { id: string; answer: Prisma.InputJsonValue }[] = [];
  let incompatible = version.questions.length === source.length ? 0 : 1;
  for (const q of version.questions) {
    const expected = source[q.order - 1];
    if (!expected || expected.questionType !== q.questionType.name || !isDeepStrictEqual(json(expected.prompt), q.promptContent)) { incompatible++; continue; }
    if (isDeepStrictEqual(json(expected.answer), q.correctAnswer)) continue;
    const existing = q.correctAnswer as Record<string, unknown> | null;
    if (expected.questionType === "Build a Sentence" && expected.answer?.acceptedOrders &&
      existing && Object.keys(existing).every((key) => key === "order") && isDeepStrictEqual(expected.answer.order, existing.order)) {
      additions.push({ id: q.id, answer: expected.answer as Prisma.InputJsonValue });
    } else incompatible++;
  }
  console.log(JSON.stringify({ version: "Simulador 1", attemptsPreserved: version._count.attempts, promptsChanged: 0,
    answerKeysToBroaden: additions.length, incompatible, canApply: incompatible === 0,
    change: "Añadir órdenes alternativos gramaticalmente válidos. No cambiar respuestas, audios, tiempos ni resultados ya guardados." }, null, 2));
  if (process.argv.includes("--apply")) {
    if (incompatible) throw new Error("Se encontraron cambios distintos de la corrección editorial prevista.");
    await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "ExamVersion" WHERE "id" = ${version.id} FOR UPDATE`;
      for (const item of additions) await tx.question.update({ where: { id: item.id }, data: { correctAnswer: item.answer } });
    });
    console.log("Claves ampliadas; intentos y resultados conservados.");
  }
} finally { await db.$disconnect(); }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
