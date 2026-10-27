import test from "node:test";
import assert from "node:assert/strict";
import { buildToeflProgress, type ProgressAttempt } from "../src/lib/toefl-progress";
function attempt(id: string, day: number, earned: number, pending = 0): ProgressAttempt {
  return { id, startedAt: new Date(Date.UTC(2026, 9, day)), completedAt: new Date(Date.UTC(2026, 9, day, 1)), label: `Simulador ${day}`, status: pending ? "PENDING_REVIEW" : "COMPLETED",
    overallScore: { scoringVersion: "verbo-toefl-practice-v1", calibrated: false, value: pending ? null : 3,
      raw: { Reading: { earned, possible: 35, pending: 0 }, Listening: { earned, possible: 35, pending: 0 }, Writing: { earned: 0, possible: 20, pending }, Speaking: { earned: 0, possible: 55, pending } } } };
}
test("progress orders completed full forms chronologically and includes zero scores", () => {
  const report = buildToeflProgress([attempt("later", 3, 25), attempt("first", 1, 0), attempt("middle", 2, 10)]);
  assert.equal(report.first?.id, "first"); assert.equal(report.latest?.id, "later");
  assert.equal(report.changes[0].first, 0); assert.equal(report.changes[0].delta, 25);
  assert.equal(report.changes[2].latest, 0);
});
test("pending reviews and diagnostics cannot become a definitive comparison", () => {
  const diagnostic = { ...attempt("diagnostic", 1, 0), overallScore: { value: 6 }, label: "Diagnóstico" };
  const report = buildToeflProgress([diagnostic, attempt("pending", 3, 35, 2), attempt("complete", 2, 20)]);
  assert.equal(report.history.length, 3); assert.equal(report.completed.length, 1); assert.equal(report.pending, 1);
  assert.equal(report.latest?.id, "complete"); assert.equal(report.changes[0].delta, null);
});
test("unfinished or incompatible results are excluded from progress comparisons", () => {
  const active = { ...attempt("active", 3, 35), status: "IN_PROGRESS" };
  const incompatible = attempt("other-scale", 2, 20);
  (incompatible.overallScore as { raw: { Reading: { possible: number } } }).raw.Reading.possible = 50;
  const report = buildToeflProgress([active, incompatible]);
  assert.equal(report.history.length, 1); assert.equal(report.completed.length, 0); assert.equal(report.latest, null);
});
