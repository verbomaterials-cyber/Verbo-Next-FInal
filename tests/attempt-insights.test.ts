import { test } from "node:test";
import assert from "node:assert/strict";
import { buildAttemptInsights, type InsightQuestion, type InsightResponse } from "../src/lib/attempt-insights";
import { TOEFL_FORM_ID } from "../src/lib/toefl-delivery";
import { RUBRIC_VERSION } from "../src/lib/toefl-rubrics";
import { emptyReport, publishedTeacherReport, reportContentZ, reportPublicationError, readTeacherReport } from "../src/lib/teacher/report";

const question = (id: string, overrides: Partial<InsightQuestion> = {}): InsightQuestion => ({ id, order: 1, promptContent: {}, correctAnswer: { options: 0 }, questionType: { name: "Reading task", responseType: "MULTIPLE_CHOICE", isScored: true, section: { skillsMeasured: ["READING"] } }, ...overrides });
const response = (questionId: string, overrides: Partial<InsightResponse> = {}): InsightResponse => ({ questionId, answerContent: { options: 0 }, isCorrect: true, reviewAssessment: null, isFlagged: false, ...overrides });
test("insights separate wrong, omitted, pending and unscored without inventing scores", () => {
  const questions = [question("correct"), question("wrong"), question("omitted"), question("pending"), question("sample", { questionType: { ...question("x").questionType, isScored: false } })];
  const result = buildAttemptInsights(questions, [response("correct"), response("wrong", { isCorrect: false }), response("pending", { isCorrect: null }), response("sample", { isCorrect: null })], null, null);
  assert.deepEqual(result.counts, { correct: 1, incorrect: 1, omitted: 1, pending: 1, partial: 0, unscored: 1 });
  assert.equal(result.skills[0].percent, 33);
  assert.equal(result.skills[0].pendingPoints, 1);
  assert.deepEqual(result.priorities, [], "an incomplete skill cannot be recommended as a settled weakness");
});
test("adaptive alternatives are excluded and a partial blank task keeps its earned credit", () => {
  const prompt = { __delivery: { formId: TOEFL_FORM_ID, section: "Reading", module: "upper" } };
  const q = question("partial", { promptContent: prompt, correctAnswer: { answers: ["one", "two"] }, questionType: { ...question("x").questionType, responseType: "FILL_BLANK" } });
  const lower = question("hidden", { promptContent: { __delivery: { ...prompt.__delivery, module: "lower" } } });
  const result = buildAttemptInsights([q, lower], [response("partial", { answerContent: { answers: ["one", "wrong"] }, isCorrect: false })], { routes: { Reading: { branch: "upper" } } }, null);
  assert.deepEqual(result.items.map(i => i.question.id), ["partial"]);
  assert.equal(result.items[0].status, "partial"); assert.equal(result.skills[0].percent, 50);
  assert.deepEqual(result.priorities, ["Reading"]);
});
test("a scored speaking rubric remains partial rather than a binary correct answer", () => {
  const q = question("spoken", { promptContent: { __delivery: { formId: TOEFL_FORM_ID, section: "Speaking", module: "linear" } }, questionType: { name: "Take an Interview", responseType: "AUDIO_RECORDING", isScored: true, section: { skillsMeasured: ["SPEAKING"] } } });
  const result = buildAttemptInsights([q], [response("spoken", { answerContent: { recorded: true }, reviewAssessment: { version: RUBRIC_VERSION, task: q.questionType.name, score: 3, source: "teacher" } })], null, null);
  assert.equal(result.items[0].status, "partial"); assert.equal(result.skills[0].percent, 60);
  assert.equal(result.items[0].possible, 5);
});
test("timeout totals retain points for an unselected second module", () => {
  const result = buildAttemptInsights([question("q")], [response("q")], null, { raw: { Reading: { earned: 1, possible: 35, pending: 0 } } });
  assert.equal(result.skills[0].percent, 3);
});
test("private drafts cannot be exposed as published reports, and publication needs completed evaluation", () => {
  const draft = { version: 1, revision: 1, draft: { ...emptyReport, summary: "Private draft" }, published: null };
  assert.equal(publishedTeacherReport(draft), null); assert.ok(readTeacherReport(draft));
  assert.ok(reportPublicationError(emptyReport, "COMPLETED"));
  const complete = { ...emptyReport, summary: "Resumen del intento", strengths: "Fortalezas observadas", improvements: "Evidencias por reforzar", studyPlan: "Actividades semanales" };
  assert.ok(reportPublicationError(complete, "PENDING_REVIEW")); assert.equal(reportPublicationError(complete, "COMPLETED"), null);
  assert.equal(reportContentZ.safeParse({ ...complete, followUpDate: "2027-02-29" }).success, false);
  assert.equal(reportContentZ.safeParse({ ...complete, focusSkills: ["READING", "READING"] }).success, false);
});
