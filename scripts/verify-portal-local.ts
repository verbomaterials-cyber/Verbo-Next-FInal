import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const target = new URL(process.env.DATABASE_URL ?? "");
if (target.hostname !== "127.0.0.1" || target.port !== "54329" || target.pathname !== "/verbo_next") throw new Error("Solo se admite la base local de prueba.");
const db = new PrismaClient(), base = "http://127.0.0.1:3000", jar = new Map<string, string>();
const created: string[] = [], checks: string[] = [];
async function request(path: string, options: RequestInit = {}) {
  const response = await fetch(base + path, { ...options, headers: { Cookie: [...jar].map(([k, v]) => `${k}=${v}`).join("; "), ...options.headers }, redirect: "manual" });
  for (const cookie of response.headers.getSetCookie()) { const pair = cookie.split(";", 1)[0], at = pair.indexOf("="); jar.set(pair.slice(0, at), pair.slice(at + 1)); }
  return response;
}
async function login(email: string, password: string) {
  jar.clear(); const csrf = await (await request("/api/auth/csrf")).json();
  await request("/api/auth/callback/credentials", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ email, password, csrfToken: csrf.csrfToken, json: "true", callbackUrl: base }) });
  const session = await (await request("/api/auth/session")).json(); assert.equal(session.user?.email, email);
}
async function profile(input: unknown) {
  const manifest = JSON.parse(await readFile(".next/dev/server/server-reference-manifest.json", "utf8"));
  const entry = Object.entries(manifest.node).find(([, raw]) => { const x = raw as { exportedName?: string; workers?: Record<string, { exportedName?: string }> }; return x.exportedName === "updateProfile" || Object.values(x.workers ?? {}).some(w => w.exportedName === "updateProfile"); });
  assert.ok(entry, "La acción de perfil debe estar compilada.");
  const response = await request("/alumno/perfil", { method: "POST", headers: { "Next-Action": entry[0], "Content-Type": "application/json", Origin: base }, body: JSON.stringify([input]) });
  assert.equal(response.status, 200);
  for (const line of (await response.text()).split("\n")) { try { const result = JSON.parse(line.slice(line.indexOf(":") + 1)); if (typeof result?.ok === "boolean") return result; } catch {} }
  throw new Error("No se recibió el resultado de la acción.");
}
async function main() {
  try {
    assert.equal((await request("/")).status, 200);
    const guestProfile = await request("/alumno/perfil"); assert.equal(guestProfile.status, 307); assert.match(guestProfile.headers.get("location") ?? "", /login/);
    checks.push("Bienvenida pública y protección del perfil sin sesión");
    const password = randomBytes(24).toString("base64url"), hash = await bcrypt.hash(password, 10);
    for (const suffix of ["a", "b"]) {
      const student = await db.student.create({ data: { email: `portal-verify-${randomBytes(7).toString("hex")}-${suffix}@verbo.local`, fullName: `Verificación temporal ${suffix}`, passwordHash: hash } });
      created.push(student.id);
    }
    const [a, b] = await Promise.all(created.map(id => db.student.findUniqueOrThrow({ where: { id } })));
    await login(a.email, password);
    const empty = await request("/alumno"); assert.equal(empty.status, 200); assert.ok((await empty.text()).includes("Tu preparación está por comenzar."));
    checks.push("Estado vacío con orientación y sin estadísticas inventadas");
    const versions = await db.examVersion.findMany({ where: { examType: { slug: "det" }, label: { in: ["Simulador DET 2026 · 2", "Simulador DET 2026 · 3"] } }, orderBy: { label: "asc" } });
    assert.equal(versions.length, 2);
    await db.enrollment.create({ data: { studentId: a.id, examTypeId: versions[0].examTypeId, accessCode: randomBytes(8).toString("hex"), attemptsAllowed: 5, attemptsUsed: 2, unlockedVersions: versions.map(v => v.id) } });
    const completed = await db.attempt.create({ data: { studentId: a.id, examVersionId: versions[1].id, status: "COMPLETED", completedAt: new Date(), overallScore: { scoringVersion: "verbo-det-practice-v1", value: 0, raw: { Reading: { earned: 0, possible: 52, pending: 0 }, Listening: { earned: 0, possible: 22, pending: 0 }, Writing: { earned: 0, possible: 40, pending: 0 }, Speaking: { earned: 0, possible: 45, pending: 0 } } } } });
    await db.attempt.create({ data: { studentId: a.id, examVersionId: versions[0].id, status: "PENDING_REVIEW", completedAt: new Date(), overallScore: { scoringVersion: "verbo-det-practice-v1", value: null } } });
    const history = await request("/alumno/resultados"); assert.equal(history.status, 200); const all = await history.text(); assert.ok(all.includes(versions[0].label)); assert.ok(all.includes(versions[1].label)); assert.ok(all.includes("En revisión")); assert.ok(all.includes("Índice de práctica / 100"));
    const filtered = await (await request("/alumno/resultados?examen=det&estado=COMPLETED")).text(); assert.ok(filtered.includes(versions[1].label)); assert.ok(!filtered.includes(versions[0].label));
    const noMatches = await (await request("/alumno/resultados?examen=not-an-exam")).text(); assert.ok(noMatches.includes("No hay intentos en esta vista."));
    checks.push("Historial real, escala DET, cero visible, revisión pendiente y filtros por examen y estado");
    assert.equal((await request("/alumno/perfil")).status, 200);
    assert.equal((await profile({ fullName: "Ada\nLovelace" })).ok, false);
    const updated = await profile({ fullName: "  Perfil temporal actualizado  ", studentId: b.id }); assert.equal(updated.ok, true);
    assert.equal((await db.student.findUniqueOrThrow({ where: { id: a.id } })).fullName, "Perfil temporal actualizado");
    assert.equal((await db.student.findUniqueOrThrow({ where: { id: b.id } })).fullName, b.fullName);
    const refreshed = await (await request("/alumno")).text(); assert.ok(refreshed.includes("Hola, ")); assert.ok(refreshed.includes("Perfil temporal actualizado"));
    checks.push("Nombre validado y persistido, navegación actualizada e ID ajeno ignorado");
    await login(b.email, password);
    const privateHistory = await (await request("/alumno/resultados")).text(); assert.ok(!privateHistory.includes(versions[1].label));
    assert.equal((await request(`/alumno/resultado/${completed.id}`)).status, 404);
    checks.push("Aislamiento de historial y resultados entre alumnos");
    const credentials = JSON.parse(await readFile(".local/access.json", "utf8")); await login(credentials.admin.email, credentials.admin.password);
    assert.equal((await request("/admin")).status, 200); assert.equal((await request("/alumno/perfil")).status, 307);
    checks.push("Panel administrativo operativo y separación por rol");
    console.log(JSON.stringify({ verified: true, checks, temporaryStudents: created.length, realStudentsChanged: 0, migrationsRun: 0 }, null, 2));
  } finally {
    for (const id of created) {
      const student = await db.student.findUnique({ where: { id } });
      if (!student?.email.startsWith("portal-verify-") || !student.email.endsWith("@verbo.local")) throw new Error("Se rechazó limpiar un registro que no pertenece a la prueba.");
      await db.student.delete({ where: { id } });
    }
    await db.$disconnect();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
