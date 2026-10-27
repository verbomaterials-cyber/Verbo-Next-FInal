import { PrismaClient } from "@prisma/client";
import { randomBytes } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import bcrypt from "bcryptjs";

async function main() {
  const url = new URL(process.env.DATABASE_URL ?? "");
  if (!["127.0.0.1", "localhost"].includes(url.hostname) || url.pathname !== "/verbo_next") {
    throw new Error("Este script solo admite la base local verbo_next.");
  }
  const credentialsPath = ".local/access.json";
  let access: { admin: { email: string; password: string }; student: { email: string; password: string } };
  try { access = JSON.parse(await readFile(credentialsPath, "utf8")); }
  catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
    access = {
      admin: { email: "admin@verbo.local", password: randomBytes(12).toString("base64url") },
      student: { email: "alumno@verbo.local", password: randomBytes(12).toString("base64url") },
    };
    await writeFile(credentialsPath, JSON.stringify(access, null, 2), { flag: "wx", mode: 0o600 });
  }
  const seed = spawnSync(process.execPath, ["--import", "tsx", "prisma/seed.ts"], {
    env: { ...process.env, SEED_ADMIN_EMAIL: access.admin.email, SEED_ADMIN_PASSWORD: access.admin.password },
    windowsHide: true, encoding: "utf8",
  });
  if (seed.status !== 0) throw new Error(seed.stderr || "No se pudo cargar el catálogo local.");
  const db = new PrismaClient();
  try {
    const student = await db.student.upsert({
      where: { email: access.student.email },
      create: { email: access.student.email, fullName: "Alumno de prueba", passwordHash: await bcrypt.hash(access.student.password, 12) },
      update: {},
    });
    for (const exam of await db.examType.findMany({ include: { examVersions: { where: { isPublished: true } } } })) {
      const accessCode = exam.slug === "toefl-ibt" ? "TOFL-2026" : "DETT-2026";
      await db.enrollment.upsert({
        where: { studentId_examTypeId: { studentId: student.id, examTypeId: exam.id } },
        create: { studentId: student.id, examTypeId: exam.id, accessCode,
          attemptsAllowed: 100, unlockedVersions: exam.examVersions.map((v) => v.id) },
        update: { accessCode },
      });
    }
  } finally { await db.$disconnect(); }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
