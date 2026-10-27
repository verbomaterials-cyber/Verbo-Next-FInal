import { PrismaClient, Prisma } from "@prisma/client";
import { isDeepStrictEqual } from "node:util";
import { toeflSeed } from "../prisma/seed-data/toefl-2026";
import { legacyToeflSampleQuestions } from "../prisma/seed-data/sample-questions";
import diagnostic from "../content/toefl-2026/diagnostic.json";
import { TOEFL_FORMAT } from "../src/lib/toefl-format";

// Default is a read-only plan. --apply is restricted to the known local demo DB.
const url = new URL(process.env.DATABASE_URL ?? "");
if (url.hostname !== "127.0.0.1" || url.port !== "54329" || url.pathname !== "/verbo_next") {
  throw new Error("Solo se admite la base local verbo_next en 127.0.0.1:54329.");
}
const db = new PrismaClient();
const aliases: Record<string, string> = {
  "Reading Comprehension": "Read an Academic Passage", "Listening Comprehension": "Listen to an Academic Talk",
  "Interview Speaking": "Take an Interview", "Academic Discussion": "Write for an Academic Discussion",
};
const canonical = (name: string) => aliases[name] ?? name;

async function main() {
  const exam = await db.examType.findUniqueOrThrow({ where: { slug: "toefl-ibt" },
    include: { sections: { include: { questionTypes: true } }, examVersions: { include: { questions: { include: { questionType: true } }, _count: { select: { attempts: true } } } } } });
  const attempts = exam.examVersions.reduce((total, version) => total + version._count.attempts, 0);
  const legacy = legacyToeflSampleQuestions();
  const knownQuestion = (question: typeof exam.examVersions[number]["questions"][number]) =>
    [...legacy, ...diagnostic.questions].some((sample) => canonical(sample.questionType) === canonical(question.questionType.name) &&
      isDeepStrictEqual(sample.prompt, question.promptContent) && isDeepStrictEqual(sample.answer, question.correctAnswer));
  const custom = exam.examVersions.flatMap((v) => v.questions).filter((q) => !knownQuestion(q));
  const diagnosticVersion = exam.examVersions.find((v) => v.label === "Diagnóstico");
  if (!diagnosticVersion) throw new Error("No se encontró la versión Diagnóstico local.");
  const safe = attempts === 0 && custom.length === 0 && exam.sections.every((section) => toeflSeed.sections.some((s) => s.name === section.name));
  const plan = { database: "local/verbo_next", formatVersion: TOEFL_FORMAT.version,
    attempts, customQuestions: custom.length, canApply: safe,
    before: { types: exam.sections.reduce((n, section) => n + section.questionTypes.length, 0), questions: diagnosticVersion.questions.length },
    after: { types: 12, diagnosticQuestions: 12, sectionOrder: toeflSeed.sections.map((s) => s.name) },
    changes: ["Actualizar solo el catálogo TOEFL local", "Conservar IDs y cuentas", "Sustituir únicamente ejemplos reconocidos", "Despublicar versiones sin preguntas"],
  };
  console.log(JSON.stringify(plan, null, 2));
  if (!process.argv.includes("--apply")) return;
  if (!safe) throw new Error("Se encontraron intentos o contenido personalizado: no se modificó el catálogo.");
  await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "ExamType" WHERE "id" = ${exam.id} FOR UPDATE`;
    if (await tx.attempt.count({ where: { examVersion: { examTypeId: exam.id } } })) {
      throw new Error("El examen ya tiene intentos. No se puede sustituir el catálogo de ejemplo.");
    }
    await tx.examType.update({ where: { id: exam.id }, data: { description: toeflSeed.description,
      totalDurationMinutes: toeflSeed.totalDurationMinutes, subscoreDefinitions: toeflSeed.subscoreDefinitions,
      scoreScale: toeflSeed.scoreScale as Prisma.InputJsonValue,
      themeConfig: toeflSeed.themeConfig as unknown as Prisma.InputJsonValue } });
    const ids = new Map<string, string>();
    for (const sectionSeed of toeflSeed.sections) {
      const original = exam.sections.find((section) => section.name === sectionSeed.name);
      const section = original ? await tx.section.update({ where: { id: original.id }, data: {
        order: sectionSeed.order, durationMinutes: sectionSeed.durationMinutes } }) : await tx.section.create({ data: {
          examTypeId: exam.id, name: sectionSeed.name, order: sectionSeed.order,
          durationMinutes: sectionSeed.durationMinutes, skillsMeasured: sectionSeed.skillsMeasured } });
      for (const type of sectionSeed.questionTypes) {
        const existing = original?.questionTypes.find((q) => canonical(q.name) === type.name);
        const data = { name: type.name, inputMedia: type.inputMedia, responseType: type.responseType,
          timingMode: type.timingMode, timePerItemSeconds: type.timePerItemSeconds ?? null,
          prepTimeSeconds: type.prepTimeSeconds ?? null, replaysAllowed: type.replaysAllowed ?? null,
          isScored: type.isScored, subscoreMapping: type.subscoreMapping,
          adminFieldSchema: type.adminFieldSchema as Prisma.InputJsonValue };
        const created = existing ? await tx.questionType.update({ where: { id: existing.id }, data })
          : await tx.questionType.create({ data: { ...data, sectionId: section.id } });
        ids.set(type.name, created.id);
      }
    }
    for (const [index, item] of diagnostic.questions.entries()) {
      const existing = diagnosticVersion.questions.find((q) => canonical(q.questionType.name) === item.questionType);
      const data = { questionTypeId: ids.get(item.questionType)!, promptContent: item.prompt as Prisma.InputJsonValue,
        correctAnswer: (item.answer ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        feedbackText: item.feedback, difficultyLevel: item.difficulty, order: index + 1 };
      if (existing) await tx.question.update({ where: { id: existing.id }, data });
      else await tx.question.create({ data: { ...data, examVersionId: diagnosticVersion.id } });
    }
    for (const version of exam.examVersions) {
      if (!version.questions.length && version.id !== diagnosticVersion.id) {
        await tx.examVersion.update({ where: { id: version.id }, data: { isPublished: false } });
      }
    }
  }, { timeout: 20_000 });
  console.log("Catálogo TOEFL 2026 actualizado. DET y las cuentas permanecen sin cambios.");
}
main().catch((error) => { console.error(error instanceof Error ? error.message : "No se pudo actualizar el catálogo."); process.exitCode = 1; })
  .finally(() => db.$disconnect());
