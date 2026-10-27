import test from "node:test";
import assert from "node:assert/strict";
import { toeflSeed } from "../prisma/seed-data/toefl-2026";
import diagnostic from "../content/toefl-2026/diagnostic.json";
import { adminFieldSchemaZ, themeConfigZ, validateQuestionPayload } from "../src/lib/exam-config";
import { advanceRuntime, beginSpokenResponse, createRuntime, type TimedQuestion } from "../src/lib/attempt-runtime";
import { autoGradeResponse } from "../src/lib/grading";

test("the 2026 catalog covers every task in the original diagnostic", () => {
  assert.deepEqual(toeflSeed.sections.map((s) => s.name), ["Reading", "Listening", "Writing", "Speaking"]);
  const types = toeflSeed.sections.flatMap((section) => section.questionTypes);
  assert.equal(types.length, 12);
  assert.equal(new Set(types.map((type) => type.name)).size, 12);
  assert.equal(diagnostic.questions.length, 12);
  themeConfigZ.parse(toeflSeed.themeConfig);
  for (const question of diagnostic.questions) {
    const type = types.find((type) => type.name === question.questionType)!;
    assert.ok(type, question.questionType);
    const schema = adminFieldSchemaZ.parse(type.adminFieldSchema);
    assert.deepEqual(validateQuestionPayload(schema, question.prompt, question.answer), [], question.questionType);
  }
});

test("word order matters, and repeated or out-of-range tiles cannot pass", () => {
  const type = toeflSeed.sections[2].questionTypes[0];
  const input = { responseType: type.responseType, isScored: true, adminFieldSchema: type.adminFieldSchema,
    promptContent: { wordBank: ["I", "am", "ready"], slots: 3 }, correctAnswer: { order: [0, 1, 2] } };
  assert.equal(autoGradeResponse({ ...input, answerContent: { order: [0, 1, 2] } }), true);
  for (const order of [[2, 1, 0], [0, 0, 2], [0, 1, 8], [0, 1]]) {
    assert.equal(autoGradeResponse({ ...input, answerContent: { order } }), false);
  }
});

test("expiring sentence building opens email without skipping the writing section", () => {
  const builder: TimedQuestion = { id: "b1", sectionId: "writing", sectionDurationMinutes: 23,
    timingMode: "PER_SECTION", timePerItemSeconds: null, prepTimeSeconds: null,
    timingGroup: { key: "build-a-sentence", durationSeconds: 360 }, enforceSectionLimit: true };
  const email: TimedQuestion = { ...builder, id: "email", timingMode: "PER_QUESTION", timePerItemSeconds: 420, timingGroup: undefined };
  const discussion: TimedQuestion = { ...email, id: "discussion", timePerItemSeconds: 600 };
  const questions = [builder, { ...builder, id: "b2" }, email, discussion];
  const state = createRuntime(questions, 0, 120);
  const next = advanceRuntime(state, questions, 360_000);
  assert.equal(next.index, 2);
  assert.equal(next.deadlineAt, 780_000);
  assert.equal(advanceRuntime(next, questions, 780_000).deadlineAt, 1_380_000);
});

test("speaking gives the full response window after the prompt and never resets it", () => {
  const questions: TimedQuestion[] = [{ id: "s1", sectionId: "speaking", sectionDurationMinutes: 8,
    timingMode: "PER_QUESTION", timePerItemSeconds: 45, prepTimeSeconds: null,
    requiresStimulus: true, enforceSectionLimit: true }];
  const initial = createRuntime(questions, 0, 120);
  assert.equal(initial.phase, "stimulus");
  const started = beginSpokenResponse(initial, questions, 20_000);
  assert.equal(started.phase, "answer");
  assert.equal(started.deadlineAt, 65_000);
  assert.deepEqual(beginSpokenResponse(started, questions, 25_000), started);
  assert.throws(() => beginSpokenResponse(initial, questions, 121_000));
});

test("the speaking section cap applies even to tasks with individual clocks", () => {
  const question: TimedQuestion = { id: "s1", sectionId: "speaking", sectionDurationMinutes: 1,
    timingMode: "PER_QUESTION", timePerItemSeconds: 45, prepTimeSeconds: null, enforceSectionLimit: true };
  const questions = [question, { ...question, id: "s2" }];
  const next = advanceRuntime(createRuntime(questions, 0, 120), questions, 40_000);
  assert.equal(next.deadlineAt, 60_000);
  assert.equal(advanceRuntime(next, questions, 60_000).finished, true);
});
