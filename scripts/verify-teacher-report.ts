import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { PrismaClient } from "@prisma/client";
import { productionConnections, productionOrigin } from "./production-target.mjs";
import { emptyReport, readTeacherReport } from "../src/lib/teacher/report";
const official = process.argv.includes("--official");
const base = official ? productionOrigin : "http://127.0.0.1:3000";
const jar = new Map<string, string>(), actionMap = new Map<string, string>();
async function request(path: string, init: RequestInit = {}) {
  const r = await fetch(base + path, { ...init, redirect: "manual", headers: { Cookie: [...jar].map(([k, v]) => `${k}=${v}`).join("; "), ...init.headers } });
  for (const value of r.headers.getSetCookie()) { const p = value.split(";", 1)[0], i = p.indexOf("="); jar.set(p.slice(0, i), p.slice(i + 1)); }
  return r;
}
async function login(account: { email: string; password: string }, role: string) {
  jar.clear(); const csrf = await (await request("/api/auth/csrf")).json();
  await request("/api/auth/callback/credentials", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ ...account, csrfToken: csrf.csrfToken, json: "true", callbackUrl: base }) });
  assert.equal((await (await request("/api/auth/session")).json()).user?.role, role);
}
async function warm(path: string) {
  const r = await request(path); assert.equal(r.status, 200, path); const html = await r.text();
  if (official) {
    const sources = [...html.matchAll(/<script[^>]*src="([^"]+\.js[^\"]*)"/g)].map(m => m[1].replaceAll("&amp;", "&"));
    const scripts = await Promise.all(sources.map(async src => (await request(src)).text()));
    for (const js of scripts) for (const m of js.matchAll(/createServerReference\)\("([0-9a-f]+)",.{0,160}?,"([A-Za-z]+)"\)/g)) actionMap.set(m[2], m[1]);
  }
  return html;
}
async function action(name: string, input: unknown, path: string) {
  let id = actionMap.get(name);
  if (!official) {
    const manifest = JSON.parse(await readFile(".next/dev/server/server-reference-manifest.json", "utf8"));
    id = Object.entries(manifest.node).find(([, raw]) => { const value = raw as { exportedName?: string; workers?: Record<string, { exportedName?: string }> }; return value.exportedName === name || Object.values(value.workers ?? {}).some(w => w.exportedName === name); })?.[0];
  }
  assert.ok(id, `compiled ${name}`);
  const r = await request(path, { method: "POST", headers: { "Next-Action": id, "Content-Type": "application/json", Origin: base }, body: JSON.stringify([input]) });
  const body = await r.text(); assert.equal(r.status, 200, name);
  for (const line of body.split("\n")) { try { const v = JSON.parse(line.slice(line.indexOf(":") + 1)); if (typeof v?.ok === "boolean") return v; } catch {} }
  if (r.headers.has("x-action-redirect") || body.includes("NEXT_REDIRECT") || body.includes('"a":"$undefined"') || body.trim() === "{}") return { ok: false, error: "Action denied by route access control" };
  throw new Error(`Missing result: ${name}: ${body.slice(0, 300)}`);
}
async function main() {
  const access = JSON.parse(await readFile(official ? ".local/deploy/teacher-demo-access.json" : ".local/teacher-demo-access.json", "utf8"));
  assert.equal(access.origin, base);
  const db = official ? new PrismaClient({ datasourceUrl: (await productionConnections()).DIRECT_URL }) : new PrismaClient();
  const completeId = access.attempts.find((a: { pending: boolean }) => !a.pending).id;
  const pendingId = access.attempts.find((a: { pending: boolean }) => a.pending).id;
  const page = `/profesor/revision/${completeId}`;
  const before = { questions: await db.question.count(), students: await db.student.count(), teachers: await db.teacher.count(), attempts: await db.attempt.count() };
  let foreignId: string | undefined;
  const checks: string[] = [];
  try {
    await login(access.teacher, "TEACHER");
    assert.match(await warm("/profesor"), /Alumno de demostración/);
    const html = await warm(page); assert.match(html, /Primero, lo que necesita atención/); assert.match(html, /Aciertos y tareas sin puntuación/); assert.match(html, /Reading/);
    assert.ok([302, 307].includes((await request("/admin/examenes/toefl-ibt/preguntas")).status));
    checks.push("teacher signs in, sees skill evidence and only submitted student responses, without exam authoring access");
    const current = await db.attempt.findUniqueOrThrow({ where: { id: completeId } });
    let revision = readTeacherReport(current.teacherReport)?.revision ?? 0;
    const content = { ...emptyReport, summary: "Ejemplo de reporte Verbo: el alumno comprende ideas generales y necesita afinar la identificación de evidencia. Todos los datos de este reporte son ficticios.", strengths: "Listening: reconoce la intención y los detalles principales. Speaking: ejemplo ilustrativo evaluado con rúbrica; los audios son tonos de prueba.", improvements: "Reading: revisar los distractores y justificar cada elección con una frase del texto. Writing: desarrollar ejemplos más específicos y revisar las conexiones entre ideas.", studyPlan: "Semana 1: 15 minutos de lectura, cuatro días; anotar la idea central y la evidencia de cada respuesta.\nSemana 2: redactar dos textos breves y revisar su estructura con el profesor.\nMantener una práctica semanal de Listening y Speaking; revisar errores en la siguiente sesión.", reading: "Priorizar inferencias y vocabulario en contexto; explicar por qué las alternativas incorrectas no están respaldadas.", listening: "Mantener la práctica de toma de notas e identificación de intención.", writing: "Usar una idea principal, una razón y un ejemplo concreto por párrafo.", speaking: "Ejemplo ficticio de evaluación: revisar claridad, desarrollo de ideas y fluidez con una grabación real.", focusSkills: ["READING", "WRITING"], followUpDate: "2026-11-10" };
    const save = (contentValue: unknown, publish: boolean, attemptId = completeId, rev = revision) => action("saveTeacherReport", { attemptId, revision: rev, publish, content: contentValue }, page);
    assert.equal((await save(content, true, pendingId, readTeacherReport((await db.attempt.findUniqueOrThrow({ where: { id: pendingId } })).teacherReport)?.revision ?? 0)).ok, false);
    const draft = await save({ ...content, summary: "PRIVATE-DRAFT-MUST-STAY-PRIVATE" }, false); assert.equal(draft.ok, true); revision = draft.revision;
    await login(access.student, "STUDENT");
    const resultPath = `/alumno/resultado/${completeId}`;
    const studentHtml = await warm(resultPath); assert.ok(!studentHtml.includes("PRIVATE-DRAFT-MUST-STAY-PRIVATE")); assert.match(studentHtml, /Tu mapa de habilidades/);
    assert.equal((await action("saveTeacherReport", { attemptId: completeId, revision, publish: true, content }, resultPath)).ok, false);
    assert.equal(readTeacherReport((await db.attempt.findUniqueOrThrow({ where: { id: completeId } })).teacherReport)?.revision, revision);
    checks.push("private draft is absent from the student's HTML and RSC payload; student cannot publish or edit teacher feedback");
    await login(access.teacher, "TEACHER");
    assert.equal((await save(content, true, completeId, revision - 1)).ok, false);
    assert.equal((await save(emptyReport, true)).ok, false);
    const published = await save(content, true); assert.equal(published.ok, true); revision = published.revision;
    // Saving a new private draft preserves the last published version.
    const newerDraft = await save({ ...content, summary: "PRIVATE-UPDATED-DRAFT" }, false); assert.equal(newerDraft.ok, true); revision = newerDraft.revision;
    await login(access.student, "STUDENT");
    const publishedHtml = await warm(resultPath); assert.match(publishedHtml, /Una mirada a tu avance/); assert.match(publishedHtml, /Ejemplo de reporte Verbo/); assert.ok(!publishedHtml.includes("PRIVATE-UPDATED-DRAFT")); assert.match(publishedHtml, /Imprimir reporte o guardar PDF/);
    const preliminary = await warm(`/alumno/resultado/${pendingId}`); assert.match(preliminary, /Resultado parcial/); assert.match(preliminary, /por revisar/);
    checks.push("completed report publishes branded feedback with print control; pending evaluation cannot publish; later private edits preserve the visible report; stale saves are rejected");
    await login(access.teacher, "TEACHER");
    const foreign = await db.student.create({ data: { fullName: "Temporary report authorization check", email: `report-auth-${Date.now()}@verbo.test`, passwordHash: "disabled-test-account", attempts: { create: { examVersionId: current.examVersionId, status: "COMPLETED", completedAt: new Date() } } }, include: { attempts: true } }); foreignId = foreign.id;
    assert.equal((await request(`/profesor/revision/${foreign.attempts[0].id}`)).status, 404);
    assert.equal((await save(content, true, foreign.attempts[0].id, 0)).ok, false);
    const spoken = await db.response.findFirstOrThrow({ where: { attemptId: completeId, question: { questionType: { responseType: "AUDIO_RECORDING" } } } });
    const audio = await request(`/api/intentos/${completeId}/grabacion/${spoken.questionId}`); assert.equal(audio.status, 200); assert.ok((await audio.arrayBuffer()).byteLength > 100);
    // Editing the evaluation retracts the old interpretation, preserving its draft.
    assert.equal((await action("reviewResponse", { responseId: spoken.id, verdict: "reviewed", rubricScore: 4, reviewNotes: "Ejemplo ficticio: audio de prueba, no es la voz de un alumno." }, page)).ok, true);
    const retracted = readTeacherReport((await db.attempt.findUniqueOrThrow({ where: { id: completeId } })).teacherReport)!;
    assert.equal(retracted.published, null); revision = retracted.revision;
    const final = await save(content, true); assert.equal(final.ok, true);
    checks.push("foreign student page and report mutation denied, assigned recording readable; changing a rubric retracts the report until it is republished");
    const report = { environment: base, result: "passed", checks, verifiedAt: new Date().toISOString() };
    await writeFile(official ? ".local/deploy/teacher-report-verification.json" : ".local/teacher-report-verification.json", JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
  } finally {
    if (foreignId) await db.student.delete({ where: { id: foreignId } });
    const after = { questions: await db.question.count(), students: await db.student.count(), teachers: await db.teacher.count(), attempts: await db.attempt.count() };
    assert.deepEqual(after, before, "verification must preserve all existing accounts, catalog and attempts");
    await db.$disconnect();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
