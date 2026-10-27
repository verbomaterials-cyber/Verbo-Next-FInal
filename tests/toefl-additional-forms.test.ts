import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { toeflForms } from "../content/toefl-2026/forms";
import { toeflSeed } from "../prisma/seed-data/toefl-2026";
import { closedPoints, delivered, deliveryMetadata, type RouteDecision } from "../src/lib/toefl-delivery";
import { validateQuestionPayload } from "../src/lib/exam-config";
import { autoGradeResponse } from "../src/lib/grading";
import { studentQuestionPayload } from "../src/lib/student/question-payload";
const types = toeflSeed.sections.flatMap((section) => section.questionTypes);
const histogram = (questions: typeof toeflForms[number]["data"]["questions"]) => questions.reduce<Record<string, number>>((result, question) => {
  const meta = deliveryMetadata(question.prompt)!;
  const key = `${meta.section}/${meta.module}/${question.questionType}/${question.difficulty}`;
  result[key] = (result[key] ?? 0) + 1; return result;
}, {});
for (const form of toeflForms.slice(1)) {
  test(`${form.label}: complete schema, solutions, editorial difficulty distribution and isolated state`, () => {
    assert.equal(form.data.questions.length, 124); assert.equal(form.audioScripts.length, 50);
    assert.deepEqual(histogram(form.data.questions), histogram(toeflForms[0].data.questions));
    assert.equal(new Set(form.data.questions.map((q) => q.key)).size, 124);
    for (const q of form.data.questions) {
      const type = types.find((candidate) => candidate.name === q.questionType)!;
      assert.deepEqual(validateQuestionPayload(type.adminFieldSchema, q.prompt, q.answer), [], q.key);
      assert.equal(deliveryMetadata(q.prompt)?.formId, form.data.formId);
      if (q.answer) assert.equal(autoGradeResponse({ responseType: type.responseType, isScored: true, adminFieldSchema: type.adminFieldSchema, promptContent: q.prompt, correctAnswer: q.answer, answerContent: q.answer }), true, q.key);
      if (Array.isArray(q.prompt.options)) assert.equal(new Set(q.prompt.options).size, 4, q.key);
      if (q.questionType === "Complete the Words") assert.equal((q.answer!.answers as unknown[]).length, 10, q.key);
      const publicPayload = JSON.stringify(studentQuestionPayload(type.adminFieldSchema, q.prompt, type.responseType));
      for (const key of ["acceptedOrders", "__delivery", "transcript", "scoredBlanks"]) assert.ok(!publicPayload.includes(key), q.key);
    }
  });
  for (const reading of ["lower", "upper"] as const) for (const listening of ["lower", "upper"] as const) {
    test(`${form.label}: ${reading}/${listening} contains 120 items and 145 available points`, () => {
      const decision = (branch: "lower" | "upper"): RouteDecision => ({ branch, earned: 0, possible: 20, threshold: .65 });
      const selected = form.data.questions.filter((q) => delivered(deliveryMetadata(q.prompt), { Reading: decision(reading), Listening: decision(listening) }));
      const count: Record<string, number> = {}, points: Record<string, number> = {};
      for (const q of selected) {
        const meta = deliveryMetadata(q.prompt)!, type = types.find((t) => t.name === q.questionType)!;
        count[meta.section] = (count[meta.section] ?? 0) + (q.questionType === "Complete the Words" ? (q.answer!.answers as unknown[]).length : 1);
        points[meta.section] = (points[meta.section] ?? 0) + (["FREE_TEXT", "AUDIO_RECORDING"].includes(type.responseType) ? 5 : closedPoints({ responseType: type.responseType, correctAnswer: q.answer, promptContent: q.prompt }, undefined).possible);
      }
      assert.deepEqual(count, { Reading: 50, Listening: 47, Writing: 12, Speaking: 11 });
      assert.deepEqual(points, { Reading: 35, Listening: 35, Writing: 20, Speaking: 55 });
      assert.equal(selected.length, 93);
    });
  }
}
test("the three forms use different stimuli, word banks and production prompts", () => {
  const seen = new Map<string, number>();
  for (const form of toeflForms) {
    const local = new Set(form.data.questions.map((q) => String(q.prompt.text ?? q.prompt.passage ?? q.prompt.transcript ?? q.prompt.scenario ?? q.prompt.professorPost ?? JSON.stringify(q.prompt.wordBank))));
    for (const text of local) {
      assert.notEqual(text, "undefined");
      assert.ok(!seen.has(text), `Stimulus repeated between forms ${seen.get(text)} and ${form.number}`);
      seen.set(text, form.number);
    }
  }
});
test("grammatical alternative sentence orders receive credit without accepting invalid permutations", () => {
  let alternatives = 0;
  for (const form of toeflForms) for (const q of form.data.questions) {
    if (!Array.isArray(q.answer?.acceptedOrders)) continue;
    const type = types.find((t) => t.name === q.questionType)!;
    for (const order of q.answer.acceptedOrders) {
      alternatives++;
      assert.equal(autoGradeResponse({ responseType: type.responseType, isScored: true, adminFieldSchema: type.adminFieldSchema,
        promptContent: q.prompt, correctAnswer: q.answer, answerContent: { order } }), true, q.key);
    }
    assert.equal(autoGradeResponse({ responseType: type.responseType, isScored: true, adminFieldSchema: type.adminFieldSchema,
      promptContent: q.prompt, correctAnswer: q.answer, answerContent: { order: [999, 999] } }), false);
  }
  assert.ok(alternatives >= 15);
});
test("new audio uses four credited voices, two locales and distinct dialogue speakers", () => {
  const manifest = JSON.parse(readFileSync("public/audio/toefl-2026/voices-forms-2-3.json", "utf8"));
  assert.equal(manifest.clips.length, 100);
  assert.equal(new Set(manifest.clips.flatMap((clip: { voices: string[] }) => clip.voices)).size, 4);
  assert.deepEqual(new Set(manifest.clips.flatMap((clip: { locales: string[] }) => clip.locales)), new Set(["en-US", "en-GB"]));
  for (const clip of manifest.clips) {
    const audio = readFileSync(`public${clip.path}`);
    assert.equal(createHash("sha256").update(audio).digest("hex"), clip.sha256);
    assert.equal(audio.toString("ascii", 0, 4), "RIFF");
    assert.equal(audio.readUInt16LE(22), 1); assert.equal(audio.readUInt32LE(24), 22050);
    assert.ok(clip.seconds > .5 && clip.seconds < 120, clip.path);
    if (clip.path.includes("conv")) assert.equal(clip.voices.length, 2, clip.path);
  }
});
