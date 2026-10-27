import fs from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import pg from "pg";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const local = path.join(root, ".local");
const dataDir = path.join(local, "postgres");
const configPath = path.join(local, "database.json");
const command = process.argv[2] ?? "start";
await fs.mkdir(local, { recursive: true });
let config;
try { config = JSON.parse(await fs.readFile(configPath, "utf8")); }
catch (error) {
  if (error.code !== "ENOENT") throw error;
  if (command !== "setup") throw new Error("Ejecuta primero npm run local:setup.");
  config = { port: 54329, user: "verbo", database: "verbo_next", password: randomBytes(24).toString("base64url") };
  await fs.writeFile(configPath, JSON.stringify(config, null, 2), { mode: 0o600, flag: "wx" });
}
const platform = process.platform === "win32" ? "windows" : process.platform;
if (config.database !== "verbo_next" || config.user !== "verbo" || config.port !== 54329 ||
  typeof config.password !== "string" || config.password.length < 20) {
  throw new Error("La configuración local no coincide con la base de este proyecto. No se modificó ninguna base.");
}
const binaries = await import(`@embedded-postgres/${platform}-${process.arch}`);
const run = (file, args, options = {}) => {
  const result = spawnSync(file, args, { cwd: root, encoding: "utf8", windowsHide: true, timeout: 60_000, ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error((result.stderr || result.stdout || `Exit ${result.status}`).trim());
  return result.stdout;
};
const status = () => spawnSync(binaries.pg_ctl, ["-D", dataDir, "status"], { windowsHide: true, encoding: "utf8" }).status === 0;

if (command === "status") {
  console.log(status() ? `PostgreSQL local activo en 127.0.0.1:${config.port}` : "PostgreSQL local detenido.");
} else if (command === "stop") {
  if (status()) run(binaries.pg_ctl, ["-D", dataDir, "-m", "fast", "-w", "stop"]);
  console.log("PostgreSQL detenido. Los datos se conservan en .local/postgres.");
} else if (command === "setup" || command === "start") {
  try { await fs.access(path.join(dataDir, "PG_VERSION")); }
  catch {
    if (command !== "setup") throw new Error("La base no está inicializada. Ejecuta npm run local:setup.");
    const passwordFile = path.join(local, "init-password");
    await fs.writeFile(passwordFile, config.password, { mode: 0o600 });
    try {
      run(binaries.initdb, ["-D", dataDir, "--username", config.user, "--auth=scram-sha-256",
        "--pwfile", passwordFile, "--encoding=UTF8", "--no-locale"]);
    } finally { await fs.unlink(passwordFile); }
  }
  if (!status()) run(binaries.pg_ctl, ["-D", dataDir, "-l", path.join(local, "postgres.log"),
    "-o", `-h 127.0.0.1 -p ${config.port}`, "-w", "start"], { stdio: "ignore" });
  const client = new pg.Client({ ...config, database: "postgres", host: "127.0.0.1", connectionTimeoutMillis: 5000 });
  await client.connect();
  try {
    if (!(await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [config.database])).rowCount) {
      await client.query(`CREATE DATABASE ${pg.escapeIdentifier(config.database)}`);
    }
  } finally { await client.end(); }

  if (command === "setup") {
    await fs.writeFile(path.join(local, "node-path.txt"), process.execPath);
    const url = `postgresql://${config.user}:${config.password}@127.0.0.1:${config.port}/${config.database}?schema=public`;
    for (const filename of [".env", ".env.local"]) {
      const fullPath = path.join(root, filename);
      let content = await fs.readFile(fullPath, "utf8").catch((e) => { if (e.code === "ENOENT") return ""; throw e; });
      const backup = path.join(local, `${filename.slice(1)}.before-local`);
      try { await fs.writeFile(backup, content, { flag: "wx", mode: 0o600 }); }
      catch (e) { if (e.code !== "EEXIST") throw e; }
      const values = { DATABASE_URL: url, DIRECT_URL: url };
      if (filename === ".env.local") {
        values.NEXTAUTH_URL = "http://localhost:3000";
        if (!/^NEXTAUTH_SECRET=.+/m.test(content)) values.NEXTAUTH_SECRET = randomBytes(32).toString("base64url");
      }
      for (const [key, value] of Object.entries(values)) {
        const line = `${key}=${JSON.stringify(value)}`;
        content = new RegExp(`^${key}=.*$`, "m").test(content)
          ? content.replace(new RegExp(`^${key}=.*$`, "m"), line)
          : `${content.trimEnd()}\n${line}\n`;
      }
      await fs.writeFile(fullPath, content, { mode: 0o600 });
    }
    const env = { ...process.env, DATABASE_URL: url, DIRECT_URL: url };
    const sourceSchema = await fs.readFile(path.join(root, "prisma/schema.prisma"), "utf8");
    const generatedSchema = await fs.readFile(path.join(root, "node_modules/.prisma/client/schema.prisma"), "utf8").catch(() => "");
    const normalizedSchema = (schema) => schema.replace(/\r/g, "").replace(/[ \t]+/g, " ").trim();
    if (normalizedSchema(sourceSchema) !== normalizedSchema(generatedSchema)) {
      run(process.execPath, ["node_modules/prisma/build/index.js", "generate"], { env });
    }
    run(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "deploy"], { env });
    run(process.execPath, ["--import", "tsx", "scripts/seed-local.ts"], { env });
    console.log("Base local preparada. Configuración anterior respaldada en .local/.");
    console.log("Credenciales de desarrollo: .local/access.json (no se versiona).");
  }
  console.log(`PostgreSQL local activo en 127.0.0.1:${config.port}. Los datos persisten al detenerlo.`);
} else {
  throw new Error("Comando válido: setup, start, stop o status.");
}
