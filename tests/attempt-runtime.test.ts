import assert from "node:assert/strict";
import test from "node:test";
import { advanceRuntime, createRuntime, previousRuntime, readRuntime, remainingSeconds, type TimedQuestion } from "../src/lib/attempt-runtime";
import { studentQuestionPayload } from "../src/lib/student/question-payload";

const reading = (id: string): TimedQuestion => ({
  id, sectionId: "reading", timingMode: "PER_SECTION", timePerItemSeconds: null,
  prepTimeSeconds: null, sectionDurationMinutes: 2,
});
const speaking: TimedQuestion = {
  id: "s1", sectionId: "speaking", timingMode: "PER_QUESTION",
  timePerItemSeconds: 45, prepTimeSeconds: 15, sectionDurationMinutes: 5,
};
const questions = [reading("r1"), reading("r2"), reading("r3"), speaking];

test("reload and changing questions preserve the original section deadline", () => {
  const initial = createRuntime(questions, 1_000_000, 20);
  const next = advanceRuntime(initial, questions, 1_050_000);
  const restored = readRuntime(JSON.parse(JSON.stringify(next)), questions)!;
  assert.equal(restored.index, 1);
  assert.equal(restored.deadlineAt, initial.deadlineAt);
  assert.equal(remainingSeconds(restored.deadlineAt, 1_060_000), 60);
});

test("section expiration skips its remaining questions in a single transition", () => {
  const state = createRuntime(questions, 0, 20);
  const next = advanceRuntime(state, questions, 120_000);
  assert.equal(next.index, 3);
  assert.equal(next.deadlineAt, 180_000);
  assert.equal(next.totalSeconds, 60);
});

test("the overall deadline ends the exam even when the browser was closed", () => {
  const state = createRuntime(questions, 0, 1);
  assert.equal(state.deadlineAt, 60_000);
  const ended = advanceRuntime(state, questions, 120_000);
  assert.equal(ended.finished, true);
  assert.deepEqual(advanceRuntime(ended, questions, 150_000), ended);
});

test("back navigation preserves section time and cannot cross a section boundary", () => {
  const initial = createRuntime(questions, 0, 20);
  const second = advanceRuntime(initial, questions, 10_000);
  const back = previousRuntime(second, questions, true, 20_000);
  assert.equal(back.index, 0);
  assert.equal(back.maxIndex, 1);
  assert.equal(back.deadlineAt, initial.deadlineAt);
  assert.throws(() => previousRuntime(second, questions, false, 20_000));
  assert.throws(() => previousRuntime(second, questions, true, 120_000));
  const spoken = advanceRuntime(second, questions, 120_000);
  assert.throws(() => previousRuntime(spoken, questions, true, 130_000));
});

test("editing a running version's question order is detected", () => {
  const initial = createRuntime(questions, 0, 20);
  assert.throws(() => readRuntime(initial, [questions[1], questions[0], ...questions.slice(2)]));
});

test("public prompts remove hidden fields, embedded solutions and undisclosed keys", () => {
  const result = studentQuestionPayload({ version: 1, fields: [
    { key: "passage", label: "Text", type: "textarea", target: "prompt" },
    { key: "topicLabel", label: "Topic", type: "text", target: "prompt", studentHidden: true },
    { key: "answer", label: "Answer", type: "text", target: "answer" },
    { key: "items", label: "Items", type: "repeater", target: "prompt", itemFields: [
      { key: "options", label: "Options", type: "options", target: "prompt", withCorrect: true },
      { key: "internal", label: "Internal", type: "text", target: "prompt", studentHidden: true },
    ] },
  ] }, {
    passage: "The w[eather] is n[ice].", topicLabel: "secret-topic", answer: "solution",
    undeclared: "secret", items: [{ options: { options: ["A", "B"], correct: 1 }, internal: "private" }],
  }, "FILL_BLANK");
  assert.deepEqual(result.prompt, {
    passage: "The w[______] is n[___].", items: [{ options: { options: ["A", "B"] } }],
  });
  assert.equal(JSON.stringify(result).includes("secret"), false);
  assert.equal(JSON.stringify(result).includes('"correct"'), false);
  assert.equal(result.schema.fields.length, 2);
});
