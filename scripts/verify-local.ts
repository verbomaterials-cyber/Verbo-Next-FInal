import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { PrismaClient, type Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { toneWavDataUri } from "../prisma/seed-data/sample-questions";
import { deliveryMetadata } from "../src/lib/toefl-delivery";

// Real HTTP, Server Actions and PostgreSQL. All created test records are removed.
const base = "http://127.0.0.1:3000";
const dbUrl = new URL(process.env.DATABASE_URL ?? "");
if (dbUrl.hostname !== "127.0.0.1" || dbUrl.pathname !== "/verbo_next") {
  throw new Error("La verificación solo admite la base local verbo_next.");
}
const db = new PrismaClient();
const jar = new Map<string, string>();
const cookies = () => [...jar].map(([key, value]) => `${key}=${value}`).join("; ");
async function request(url: string, init: RequestInit = {}) {
  const response = await fetch(`${base}${url}`, { ...init,
    headers: { Cookie: cookies(), ...init.headers }, redirect: "manual" });
  for (const value of response.headers.getSetCookie()) {
    const pair = value.split(";", 1)[0];
    const separator = pair.indexOf("=");
    jar.set(pair.slice(0, separator), pair.slice(separator + 1));
  }
  return response;
}
async function login(email: string, password: string) {
  jar.clear();
  const csrf = await (await request("/api/auth/csrf")).json();
  const response = await request("/api/auth/callback/credentials", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ email, password, csrfToken: csrf.csrfToken, json: "true", callbackUrl: base }),
  });
  assert.equal(response.status, 200);
  const session = await (await request("/api/auth/session")).json();
  assert.ok(session.user?.email === email, "El login HTTP debe establecer una sesión real.");
}
async function action(name: string, input: unknown, page = "/alumno/examen/toefl-ibt") {
  const manifestPath = process.env.VERIFY_PRODUCTION === "1"
    ? ".next/server/server-reference-manifest.json" : ".next/dev/server/server-reference-manifest.json";
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const entry = Object.entries(manifest.node).find(([, raw]) => {
    const value = raw as { exportedName?: string; workers?: Record<string, { exportedName?: string }> };
    return value.exportedName === name || Object.values(value.workers ?? {}).some((worker) => worker.exportedName === name);
  });
  assert.ok(entry, `Acción compilada: ${name}`);
  const response = await request(page, { method: "POST", headers: {
    "Next-Action": entry[0], "Content-Type": "application/json", Origin: base,
  }, body: JSON.stringify([input]) });
  const body = await response.text();
  assert.equal(response.status, 200, `HTTP ${name}`);
  for (const line of body.split("\n")) {
    const json = line.slice(line.indexOf(":") + 1);
    try {
      const value = JSON.parse(json);
      if (typeof value?.ok === "boolean") return value;
    } catch { /* RSC entries and references are not action results. */ }
  }
  throw new Error(`No se recibió el resultado de ${name}.`);
}

async function main() {
let studentId: string | undefined;
const report: string[] = [];
try {
  const formNumber = /^simulator([123])$/.exec(process.env.VERIFY_FORM ?? "")?.[1];
  const full = !!formNumber;
  const lower = process.env.VERIFY_LOWER === "1";
  const version = await db.examVersion.findFirstOrThrow({ where: { label: full ? `Simulador ${formNumber}` : "Diagnóstico", examType: { slug: "toefl-ibt" } },
    include: { questions: { include: { questionType: { include: { section: true } } } } } });
  const password = randomBytes(16).toString("base64url");
  const student = await db.student.create({ data: { fullName: "Verificación local temporal",
    email: `verify-${randomBytes(5).toString("hex")}@verbo.local`, teacherEmail: `teacher-${randomBytes(5).toString("hex")}@verbo.local`, passwordHash: await bcrypt.hash(password, 10) } });
  studentId = student.id;
  const enrollment = await db.enrollment.create({ data: { studentId, examTypeId: version.examTypeId,
    accessCode: randomBytes(6).toString("hex").toUpperCase(), attemptsAllowed: 1, unlockedVersions: [version.id] } });
  await login(student.email, password);
  await request("/alumno/examen/toefl-ibt");
  assert.equal((await action("verifyAccessCode", { slug: "toefl-ibt", code: enrollment.accessCode })).ok, true);
  report.push("Login y código de acceso por HTTP");
  const starts = await Promise.all([action("startAttempt", { examVersionId: version.id }), action("startAttempt", { examVersionId: version.id })]);
  assert.ok(starts.every((r) => r.ok));
  assert.equal(starts[0].data.attemptId, starts[1].data.attemptId);
  assert.equal((await db.enrollment.findUniqueOrThrow({ where: { id: enrollment.id } })).attemptsUsed, 1);
  const attemptId = starts[0].data.attemptId as string;
  const page = `/alumno/intento/${attemptId}`;
  const pageResponse = await request(page);
  assert.equal(pageResponse.status, 200);
  if (full) {
    const html = await pageResponse.text();
    const hidden = version.questions.find((q) => deliveryMetadata(q.promptContent)?.module === "upper" && typeof (q.promptContent as Record<string, unknown>).title === "string");
    if (hidden) assert.ok(!html.includes(String((hidden.promptContent as Record<string, unknown>).title)), "No se envía el contenido de una rama todavía no elegida.");
    assert.ok(!html.includes("scoredBlanks"), "Los metadatos de puntuación no llegan al alumno.");
  }
  report.push("Dos inicios simultáneos consumen un solo intento");
  const questions = [...version.questions].sort((a, b) =>
    (a.questionType.section.order ?? 0) - (b.questionType.section.order ?? 0) || a.order - b.order || a.id.localeCompare(b.id));
  const progress = await action("getAttemptProgress", attemptId, page);
  const restored = await action("getAttemptProgress", attemptId, page);
  if (full && process.env.VERIFY_EXPIRE_EARLY === "1") {
    const current = await db.attempt.findUniqueOrThrow({ where: { id: attemptId } });
    await db.attempt.update({ where: { id: attemptId }, data: { runtimeState: { ...(current.runtimeState as Prisma.JsonObject), examDeadlineAt: Date.now() - 1000, deadlineAt: Date.now() - 1000 } } });
    const next = await action("navigateAttempt", { attemptId, questionId: questions[0].id, answerContent: {}, isFlagged: false, direction: "next" }, page);
    assert.equal(next.data.finished, true);
    assert.equal((await action("completeAttempt", { attemptId }, page)).ok, true);
    const final = await db.attempt.findUniqueOrThrow({ where: { id: attemptId } });
    const score = final.overallScore as { raw: Record<string, { possible: number }> };
    assert.deepEqual(Object.fromEntries(Object.entries(score.raw).map(([name, value]) => [name, value.possible])), { Reading: 35, Listening: 35, Writing: 20, Speaking: 55 });
    console.log("Plazo global agotado: finalización segura y puntos máximos completos 35/35/20/55, aunque no se haya elegido la segunda ruta.");
    return;
  }
  assert.equal(progress.data.deadlineAt, restored.data.deadlineAt);
  report.push("El plazo persiste al recuperar el intento");
  const external = await db.question.findFirstOrThrow({ where: { examVersion: { examType: { slug: "det" } } } });
  const invalid = await action("saveResponse", { attemptId, questionId: external.id, answerContent: {}, isFlagged: false }, page);
  assert.equal(invalid.ok, false);
  assert.equal(await db.response.count({ where: { attemptId, questionId: external.id } }), 0);
  assert.equal((await action("completeAttempt", { attemptId }, page)).ok, false);
  report.push("Rechazo de preguntas ajenas y envíos prematuros");
  let cursor = progress.data;
  let visited = 0;
  while (!cursor.finished) {
    assert.ok(visited++ < questions.length, "El recorrido debe terminar sin repetir preguntas.");
    const question = cursor.questionId ? questions.find((q) => q.id === cursor.questionId)! : questions[cursor.index];
    assert.ok(question);
    let answerContent: Record<string, unknown> = question.correctAnswer as Record<string, unknown> ?? { text: "This original response describes the benefits of working together in a community garden." };
    if (full && lower && deliveryMetadata(question.promptContent)?.module === "router") answerContent = {};
    if (question.questionType.responseType === "AUDIO_RECORDING") {
      const speaking = await action("beginSpeaking", { attemptId, questionId: question.id }, page);
      assert.equal(speaking.ok, true);
      const audio = Buffer.from(toneWavDataUri(1).split(",")[1], "base64");
      const endpoint = `/api/intentos/${attemptId}/grabacion/${question.id}`;
      const upload = await request(endpoint, { method: "POST", headers: { "Content-Type": "audio/wav", "x-duration-seconds": "1", Origin: base }, body: audio });
      assert.equal(upload.status, 200);
      answerContent = await upload.json();
      const playback = await request(endpoint);
      assert.equal(playback.status, 200);
      assert.deepEqual(Buffer.from(await playback.arrayBuffer()), audio);
      assert.equal((await fetch(`${base}${endpoint}`)).status, 401);
      report.push("Audio real guardado y reproducible; acceso anónimo rechazado");
    }
    const input = { attemptId, questionId: question.id, answerContent, isFlagged: false, direction: "next" };
    const navigated = await action("navigateAttempt", input, page);
    assert.equal(navigated.ok, true);
    const retried = await action("navigateAttempt", input, page);
    assert.deepEqual(retried.data.index, navigated.data.index);
    assert.equal(retried.data.finished, navigated.data.finished);
    cursor = navigated.data;
  }
  if (full) {
    assert.equal(visited, 93);
    const chosen = lower ? "lower" : "upper";
    assert.equal(cursor.routes.Reading.branch, chosen);
    assert.equal(cursor.routes.Listening.branch, chosen);
    const stored = await db.response.findMany({ where: { attemptId }, include: { question: true } });
    assert.ok(stored.every((r) => !["lower", "upper"].includes(deliveryMetadata(r.question.promptContent)?.module ?? "") || deliveryMetadata(r.question.promptContent)?.module === chosen));
    report.push(`120 reactivos en 93 pantallas; rutas ${chosen}/${chosen}; sin respuestas en la rama descartada`);
  }
  const completions = await Promise.all([action("completeAttempt", { attemptId }, page), action("completeAttempt", { attemptId }, page)]);
  assert.ok(completions.every((result) => result.ok), "El envío simultáneo debe ser idempotente.");
  assert.equal((await db.attempt.findUniqueOrThrow({ where: { id: attemptId } })).status, "PENDING_REVIEW");
  assert.equal(await db.emailDelivery.count({ where: { eventKey: { startsWith: `attempt:${attemptId}:submitted:` }, recipient: { in: [student.email, student.teacherEmail!] } } }), 2, "One submission notice per student and teacher despite concurrent submissions");
  report.push("Navegación idempotente, respuestas persistidas y examen enviado");
  const access = JSON.parse(await readFile(".local/access.json", "utf8"));
  await login(access.admin.email, access.admin.password);
  const reviewPage = `/admin/revision/${attemptId}`;
  assert.equal((await request(reviewPage)).status, 200);
  const responses = await db.response.findMany({ where: { attemptId, isCorrect: null } });
  for (const response of responses) {
    const reviewed = await action("reviewResponse", { responseId: response.id, verdict: "correct", reviewNotes: "Verificación local temporal.", ...(full ? { rubricScore: 4 } : {}) }, reviewPage);
    assert.equal(reviewed.ok, true);
  }
  assert.equal((await db.attempt.findUniqueOrThrow({ where: { id: attemptId } })).status, "COMPLETED");
  assert.equal(await db.emailDelivery.count({ where: { eventKey: { startsWith: `attempt:${attemptId}:reviewed:` }, recipient: { in: [student.email, student.teacherEmail!] } } }), 2, "Final review queues a notice for the student and teacher");
  report.push("Avisos de envío y revisión para alumno y profesor, sin duplicados concurrentes");
  if (full) {
    const teacherProgress = await request(`/admin/alumnos/${studentId}/progreso`);
    assert.equal(teacherProgress.status, 200);
    assert.ok((await teacherProgress.text()).includes("PROGRESO TOEFL"));
  }
  if (full) {
    const final = await db.attempt.findUniqueOrThrow({ where: { id: attemptId } });
    const score = final.overallScore as { raw: Record<string, { earned: number; possible: number }>; calibrated: boolean };
    assert.equal(score.calibrated, false);
    assert.deepEqual(Object.fromEntries(Object.entries(score.raw).map(([name, section]) => [name, section.possible])), { Reading: 35, Listening: 35, Writing: 20, Speaking: 55 });
    assert.equal(score.raw.Writing.earned, 18);
    assert.equal(score.raw.Speaking.earned, 44);
    if (!lower) { assert.equal(score.raw.Reading.earned, 35); assert.equal(score.raw.Listening.earned, 35); }
    const studentEmail = student.email;
    await login(studentEmail, password);
    assert.equal((await action("verifyAccessCode", { slug: "toefl-ibt", code: enrollment.accessCode })).ok, true);
    const resultPage = await request(`/alumno/resultado/${attemptId}`);
    assert.equal(resultPage.status, 200);
    const resultText = await resultPage.text();
    assert.ok(resultText.includes("Banda de práctica"));
    const history = await request("/alumno/progreso/toefl-ibt");
    assert.equal(history.status, 200);
    const historyText = await history.text();
    assert.ok(historyText.includes("Mi progreso") && historyText.includes(version.label));
    assert.ok([302, 303, 307, 308].includes((await request(`/admin/alumnos/${studentId}/progreso`)).status), "El alumno no puede abrir el progreso del panel de administración.");
    report.push("Resultado evaluado disponible en el historial privado del alumno");
    report.push("Rúbricas 4/5 conservadas; puntos 35/35/20/55; resultado sin ramas descartadas");
  }
  report.push("Revisión humana desde sesión admin y resultado final recalculado");
  console.log(JSON.stringify({ passed: report }, null, 2));
} finally {
  if (studentId) {
    const student = await db.student.findUnique({ where: { id: studentId }, select: { email: true, teacherEmail: true } });
    if (student) await db.emailDelivery.deleteMany({ where: { recipient: { in: [student.email, ...(student.teacherEmail ? [student.teacherEmail] : [])] } } });
    const attempts = await db.attempt.findMany({ where: { studentId }, select: { id: true } });
    await db.notification.deleteMany({ where: { attemptId: { in: attempts.map((a) => a.id) } } });
    await db.student.delete({ where: { id: studentId } });
  }
  await db.$disconnect();
}
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
