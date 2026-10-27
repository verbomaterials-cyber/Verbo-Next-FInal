import fs from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import bcrypt from "bcryptjs";
import { Prisma, PrismaClient } from "@prisma/client";
import { root, projectRef, productionOrigin, productionConnections, envValue } from "./production-target.mjs";

const apply = process.argv.includes("--apply");
const tableNames = ["ExamType", "Section", "QuestionType", "ExamVersion", "Question", "Student", "Enrollment", "AdminUser", "Attempt", "Response", "Notification", "Recording"];
const catalogModels = ["examType", "section", "questionType", "examVersion", "question"];
const connections = await productionConnections();
const remote = new PrismaClient({ datasourceUrl: connections.DIRECT_URL });
let local;

try {
  // All remote access is pinned to the project confirmed by the user.
  const tables = await remote.$queryRaw`SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`;
  const unknown = tables.filter((row) => !tableNames.includes(row.tablename) && row.tablename !== "_prisma_migrations");
  if (unknown.length) throw new Error("La base contiene tablas ajenas a Next: se requiere revisar antes de modificarla.");
  console.log(JSON.stringify({ target: projectRef, origin: productionOrigin, existingTables: tables.map((row) => row.tablename), mode: apply ? "apply" : "read-only" }));
  if (!apply) process.exitCode = 0;
  else {
    const localEnv = await fs.readFile(path.join(root, ".env.local"), "utf8");
    const localUrl = envValue(localEnv, "DATABASE_URL");
    const parsedLocal = new URL(localUrl);
    if (parsedLocal.hostname !== "127.0.0.1" || parsedLocal.port !== "54329" || parsedLocal.pathname !== "/verbo_next") throw new Error("La fuente debe ser la base local de Next; no se leen otras bases remotas.");
    local = new PrismaClient({ datasourceUrl: localUrl });
    const catalog = Object.fromEntries(await Promise.all(catalogModels.map(async (model) => [model, await local[model].findMany()])));
    if (!catalog.examType.length || !catalog.question.length) throw new Error("El catálogo local está vacío.");
    const privateDir = path.join(root, ".local/deploy");
    await fs.mkdir(privateDir, { recursive: true });
    await fs.writeFile(path.join(privateDir, "catalog.json"), JSON.stringify(catalog), { mode: 0o600 });

    const migration = spawnSync(process.execPath, [path.join(root, "node_modules/prisma/build/index.js"), "migrate", "deploy"], {
      cwd: root, env: { ...process.env, ...connections }, encoding: "utf8", windowsHide: true, timeout: 120000,
    });
    if (migration.status !== 0) throw new Error("Falló prisma migrate deploy. Revisar las migraciones del proyecto Next.");
    console.log(migration.stdout.replace(/postgres(?:ql)?:\/\/\S+/g, "[conexión privada]"));

    // NextAuth + Prisma own authorization. The public Supabase Data API must not
    // provide an alternate path to answers, credentials, or students' recordings.
    await remote.$transaction(async (tx) => {
      for (const table of [...tableNames, "_prisma_migrations"]) {
        await tx.$executeRawUnsafe(`ALTER TABLE public."${table}" ENABLE ROW LEVEL SECURITY`);
        await tx.$executeRawUnsafe(`REVOKE ALL ON TABLE public."${table}" FROM anon, authenticated`);
      }
    }, { timeout: 30000 });

    await remote.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(84721931)`;
      const current = await tx.examType.count();
      if (current === 0) {
        if (await tx.student.count() || await tx.attempt.count()) throw new Error("Se detectaron datos de alumnos; no se instala contenido automáticamente.");
        await tx.examType.createMany({ data: catalog.examType });
        await tx.section.createMany({ data: catalog.section });
        await tx.questionType.createMany({ data: catalog.questionType });
        await tx.examVersion.createMany({ data: catalog.examVersion });
        await tx.question.createMany({ data: catalog.question.map((row) => ({ ...row, correctAnswer: row.correctAnswer === null ? Prisma.DbNull : row.correctAnswer })) });
      } else {
        for (const model of catalogModels) if (await tx[model].count() !== catalog[model].length) throw new Error("El catálogo remoto ya contiene cambios: se conserva sin reemplazarlo.");
      }
    }, { timeout: 120000 });

    const accessPath = path.join(privateDir, "access.json");
    let access;
    try { access = JSON.parse(await fs.readFile(accessPath, "utf8")); }
    catch (error) {
      if (error.code !== "ENOENT") throw error;
      access = { admin: { email: "verbomaterials@gmail.com", password: randomBytes(18).toString("base64url") } };
      await fs.writeFile(accessPath, JSON.stringify(access, null, 2), { mode: 0o600, flag: "wx" });
    }
    if (await remote.adminUser.count() === 0) await remote.adminUser.create({ data: { email: access.admin.email, passwordHash: await bcrypt.hash(access.admin.password, 12), role: "SUPERADMIN" } });

    const envPath = path.join(privateDir, "vercel-env.json");
    let prior = {};
    try { prior = JSON.parse(await fs.readFile(envPath, "utf8")); } catch (error) { if (error.code !== "ENOENT") throw error; }
    await fs.writeFile(envPath, JSON.stringify({ ...connections, NEXTAUTH_URL: productionOrigin, NEXTAUTH_SECRET: prior.NEXTAUTH_SECRET || randomBytes(32).toString("base64url") }, null, 2), { mode: 0o600 });

    const security = await remote.$queryRaw`SELECT c.relname, c.relrowsecurity,
      has_table_privilege('anon', c.oid, 'SELECT') AS anon_select,
      has_table_privilege('authenticated', c.oid, 'SELECT') AS authenticated_select
      FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relkind='r'`;
    if (security.some((row) => !row.relrowsecurity || row.anon_select || row.authenticated_select)) throw new Error("La verificación de acceso privado falló.");
    console.log(JSON.stringify({ target: projectRef, catalog: Object.fromEntries(await Promise.all(catalogModels.map(async (model) => [model, await remote[model].count()]))), admins: await remote.adminUser.count(), students: await remote.student.count(), attempts: await remote.attempt.count(), privateTables: security.length, credentialsFile: ".local/deploy/access.json", environmentFile: ".local/deploy/vercel-env.json" }));
  }
} catch (error) {
  // Do not print Prisma messages or environment values that may contain secrets.
  console.error(error instanceof Prisma.PrismaClientInitializationError ? `No se pudo conectar a Next (${error.errorCode ?? "autenticación o red"}).` : error.message.replace(/postgres(?:ql)?:\/\/\S+/g, "[conexión privada]"));
  process.exitCode = 1;
} finally {
  await remote.$disconnect();
  await local?.$disconnect();
}
