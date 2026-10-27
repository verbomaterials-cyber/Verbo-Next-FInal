import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { formQuestions, audioScripts } from "../content/toefl-2026/simulator-1";
import { toeflSeed } from "../prisma/seed-data/toefl-2026";
import { validateQuestionPayload } from "../src/lib/exam-config";
import { closedPoints, delivered, deliveryMetadata, moduleSeconds, type RouteDecision } from "../src/lib/toefl-delivery";
import { advanceRuntime, createRuntime, jumpRuntime, previousRuntime, readRuntime, type TimedQuestion } from "../src/lib/attempt-runtime";
import { studentQuestionPayload } from "../src/lib/student/question-payload";
import { autoGradeResponse } from "../src/lib/grading";
const types = toeflSeed.sections.flatMap((s) => s.questionTypes);
const timed: TimedQuestion[] = formQuestions.map((q) => {
  const meta = deliveryMetadata(q.prompt)!;
  const type = types.find((t) => t.name === q.questionType)!;
  const seconds = moduleSeconds(meta);
  return { id: q.key, sectionId: meta.section, sectionDurationMinutes: 30, timingMode: type.timingMode,
    timePerItemSeconds: meta.responseSeconds ?? type.timePerItemSeconds ?? null, prepTimeSeconds: null,
    timingGroup: seconds ? { key: `${meta.section}-${meta.module}`, durationSeconds: seconds } : type.adminFieldSchema.timingGroup,
    delivery: meta, possiblePoints: closedPoints({ responseType: type.responseType, correctAnswer: q.answer, promptContent: q.prompt }, undefined).possible };
});
test("form 1 contains valid original tasks, exact answer keys, and no duplicate keys", () => {
  assert.equal(formQuestions.length, 124);
  assert.equal(new Set(formQuestions.map((q) => q.key)).size, formQuestions.length);
  for (const q of formQuestions) {
    const type = types.find((t) => t.name === q.questionType)!;
    assert.deepEqual(validateQuestionPayload(type.adminFieldSchema, q.prompt, q.answer), [], q.key);
    if (q.answer) assert.equal(autoGradeResponse({ responseType: type.responseType, isScored: true, adminFieldSchema: type.adminFieldSchema, promptContent: q.prompt, correctAnswer: q.answer, answerContent: q.answer }), true, q.key);
    if (Array.isArray(q.prompt.options)) assert.equal(new Set(q.prompt.options).size, 4, q.key);
    assert.ok(q.feedback.length > 30, q.key);
    const publicPayload = JSON.stringify(studentQuestionPayload(type.adminFieldSchema, q.prompt, type.responseType));
    for (const secret of ["__delivery", "transcript", "scoredBlanks"]) assert.ok(!publicPayload.includes(secret), `${q.key}: ${secret}`);
  }
});
for (const reading of ["lower", "upper"] as const) for (const listening of ["lower", "upper"] as const) {
  test(`route ${reading}/${listening} delivers 120 items and the 35/35/20/55 point blueprint`, () => {
    const decision = (branch: "lower" | "upper"): RouteDecision => ({ branch, earned: 0, possible: 20, threshold: .65 });
    const routes = { Reading: decision(reading), Listening: decision(listening) };
    const selected = formQuestions.filter((q) => delivered(deliveryMetadata(q.prompt), routes));
    const count: Record<string, number> = {}, points: Record<string, number> = {};
    for (const q of selected) {
      const m = deliveryMetadata(q.prompt)!;
      count[m.section] = (count[m.section] ?? 0) + (q.questionType === "Complete the Words" ? (q.answer!.answers as string[]).length : 1);
      const type = types.find((t) => t.name === q.questionType)!;
      const max = ["FREE_TEXT", "AUDIO_RECORDING"].includes(type.responseType) ? 5 : closedPoints({ responseType: type.responseType, correctAnswer: q.answer, promptContent: q.prompt }, q.answer ?? undefined).possible;
      points[m.section] = (points[m.section] ?? 0) + max;
    }
    assert.deepEqual(count, { Reading: 50, Listening: 47, Writing: 12, Speaking: 11 });
    assert.deepEqual(points, { Reading: 35, Listening: 35, Writing: 20, Speaking: 55 });
    assert.equal(selected.length, 93);
  });
}
test("routing uses weighted scored responses, persists the branch, and skips the other branch", () => {
  for (const perfect of [false, true]) {
    let state = createRuntime(timed, 1000, 120);
    const earned = Object.fromEntries(timed.map((q) => [q.id, perfect ? q.possiblePoints ?? 0 : 0]));
    while (timed[state.index].delivery?.module === "router" && timed[state.index].sectionId === "Reading") state = advanceRuntime(state, timed, 2000, earned);
    assert.equal(state.routes.Reading.branch, perfect ? "upper" : "lower");
    assert.equal(timed[state.index].delivery?.module, perfect ? "upper" : "lower");
    assert.equal(readRuntime(JSON.parse(JSON.stringify(state)), timed)?.deadlineAt, state.deadlineAt);
    assert.throws(() => previousRuntime(state, timed, true, 2001));
    while (timed[state.index].sectionId === "Reading") state = advanceRuntime(state, timed, 3000, earned);
    assert.equal(timed[state.index].sectionId, "Listening");
  }
});
test("expiration closes the router once, chooses the lower branch, and preserves review clocks", () => {
  const start = createRuntime(timed, 1000, 120);
  const second = advanceRuntime(start, timed, 2000);
  const reviewed = jumpRuntime(second, timed, timed[0].id, 3000);
  assert.equal(reviewed.deadlineAt, start.deadlineAt);
  assert.throws(() => jumpRuntime(start, timed, timed[5].id, 2000));
  const expired = advanceRuntime(reviewed, timed, start.deadlineAt);
  assert.equal(expired.routes.Reading.branch, "lower");
  assert.equal(timed[expired.index].delivery?.module, "lower");
  assert.equal(expired.deadlineAt, start.deadlineAt + 540000);
});
test("every stimulus has a nonempty local speech WAV", () => {
  assert.equal(audioScripts.length, 50);
  for (const audio of audioScripts) {
    const bytes = readFileSync(`public/audio/toefl-2026/form-1/${audio.id}.wav`);
    assert.equal(bytes.toString("ascii", 0, 4), "RIFF", audio.id);
    assert.equal(bytes.toString("ascii", 8, 12), "WAVE", audio.id);
    assert.ok(bytes.length > 1000, audio.id);
    assert.ok(audio.turns.every((turn) => turn.text.length > 10));
  }
});
