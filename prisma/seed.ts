import { PrismaClient, Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import type { ExamSeed } from "./seed-data/types";
import { detSeed } from "./seed-data/det";
import { toeflSeed } from "./seed-data/toefl";
import {
  detSampleQuestions,
  toeflSampleQuestions,
  type SampleQuestion,
} from "./seed-data/sample-questions";

const prisma = new PrismaClient();

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? "ramirez.jaret98@gmail.com";

async function seedAdmin() {
  const existing = await prisma.adminUser.findUnique({
    where: { email: ADMIN_EMAIL },
  });
  if (existing) {
    console.log(`AdminUser ya existe (${ADMIN_EMAIL}) — sin cambios.`);
    return;
  }

  const password = process.env.SEED_ADMIN_PASSWORD ?? crypto.randomBytes(9).toString("base64url");
  await prisma.adminUser.create({
    data: {
      email: ADMIN_EMAIL,
      passwordHash: await bcrypt.hash(password, 12),
      role: "SUPERADMIN",
    },
  });

  console.log("─".repeat(52));
  console.log("AdminUser creado.");
  console.log(`  Email:      ${ADMIN_EMAIL}`);
  if (!process.env.SEED_ADMIN_PASSWORD) console.log(`  Contraseña: ${password}`);
  console.log("Guárdala ahora — no se volverá a mostrar.");
  console.log("─".repeat(52));
}

// Idempotente por slug: si el examen ya existe no se toca,
// para no pisar cambios hechos después desde el panel admin.
async function seedExam(seed: ExamSeed) {
  const existing = await prisma.examType.findUnique({
    where: { slug: seed.slug },
  });
  if (existing) {
    console.log(`ExamType "${seed.slug}" ya existe — sin cambios.`);
    return;
  }

  await prisma.$transaction(async (tx) => {
    const examType = await tx.examType.create({
      data: {
        name: seed.name,
        slug: seed.slug,
        description: seed.description,
        totalDurationMinutes: seed.totalDurationMinutes,
        sectionOrderMode: seed.sectionOrderMode,
        hasAdaptiveLogic: seed.hasAdaptiveLogic,
        subscoreDefinitions: seed.subscoreDefinitions,
        scoreScale: seed.scoreScale as Prisma.InputJsonValue,
        themeConfig: seed.themeConfig as unknown as Prisma.InputJsonValue,
      },
    });

    for (const section of seed.sections) {
      await tx.section.create({
        data: {
          examTypeId: examType.id,
          name: section.name,
          order: section.order ?? null,
          durationMinutes: section.durationMinutes,
          skillsMeasured: section.skillsMeasured,
          questionTypes: {
            create: section.questionTypes.map((qt) => ({
              name: qt.name,
              inputMedia: qt.inputMedia,
              responseType: qt.responseType,
              timingMode: qt.timingMode,
              timePerItemSeconds: qt.timePerItemSeconds ?? null,
              prepTimeSeconds: qt.prepTimeSeconds ?? null,
              replaysAllowed: qt.replaysAllowed ?? null,
              isScored: qt.isScored,
              subscoreMapping: qt.subscoreMapping,
              adminFieldSchema: qt.adminFieldSchema,
            })),
          },
        },
      });
    }

    await tx.examVersion.createMany({
      data: seed.versions.map((v) => ({
        examTypeId: examType.id,
        label: v.label,
        hasFeedback: v.hasFeedback,
        isPublished: v.isPublished,
      })),
    });
  });

  console.log(
    `ExamType "${seed.name}" creado: ${seed.sections.length} secciones, ` +
      `${seed.sections.reduce((n, s) => n + s.questionTypes.length, 0)} tipos de pregunta, ` +
      `${seed.versions.length} versiones.`,
  );
}

/*
 * Inserta preguntas de ejemplo en la versión "Diagnóstico" del examen.
 * Idempotente por tipo: si el tipo ya tiene preguntas en esa versión, se salta.
 */
async function seedSampleQuestions(slug: string, samples: SampleQuestion[]) {
  const exam = await prisma.examType.findUnique({
    where: { slug },
    include: {
      examVersions: { where: { label: "Diagnóstico" } },
      sections: { include: { questionTypes: true } },
    },
  });
  const version = exam?.examVersions[0];
  if (!exam || !version) {
    console.log(`Sin versión Diagnóstico para "${slug}" — se omiten ejemplos.`);
    return;
  }

  const typesByName = new Map(
    exam.sections.flatMap((s) => s.questionTypes).map((qt) => [qt.name, qt]),
  );

  let order =
    (
      await prisma.question.aggregate({
        where: { examVersionId: version.id },
        _max: { order: true },
      })
    )._max.order ?? 0;

  let created = 0;
  for (const sample of samples) {
    const qt = typesByName.get(sample.questionType);
    if (!qt) {
      console.log(`  ⚠ Tipo "${sample.questionType}" no existe en ${slug} — omitido.`);
      continue;
    }
    const existing = await prisma.question.count({
      where: { examVersionId: version.id, questionTypeId: qt.id },
    });
    if (existing > 0) continue;

    await prisma.question.create({
      data: {
        examVersionId: version.id,
        questionTypeId: qt.id,
        promptContent: sample.prompt as Prisma.InputJsonValue,
        correctAnswer: (sample.answer ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        feedbackText: sample.feedback ?? null,
        difficultyLevel: sample.difficulty ?? null,
        order: ++order,
      },
    });
    created++;
  }
  if (created > 0) console.log(`Ejemplos para "${slug}": ${created} pregunta(s) nuevas.`);
  else console.log(`Ejemplos para "${slug}": nada que agregar.`);
}

async function main() {
  await seedAdmin();
  await seedExam(detSeed);
  await seedExam(toeflSeed);
  await seedSampleQuestions("det", detSampleQuestions());
  await seedSampleQuestions("toefl-ibt", toeflSampleQuestions());
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
