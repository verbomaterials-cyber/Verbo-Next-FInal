import { test } from "node:test";
import assert from "node:assert/strict";
import { safeCallbackPath, practiceScore, portalDate } from "../src/lib/portal";
import { profileNameZ } from "../src/lib/student/profile-validation";

test("login callbacks stay on this application and preserve protected destination queries", () => {
  for (const unsafe of [null, "https://example.com", "//example.com", "/\\example.com", "/\n/example.com", "javascript:alert(1)", "alumno"]) assert.equal(safeCallbackPath(unsafe), "/alumno");
  assert.equal(safeCallbackPath("/alumno/resultados?estado=COMPLETED#historial"), "/alumno/resultados?estado=COMPLETED#historial");
  assert.equal(safeCallbackPath("/admin/alumnos"), "/admin/alumnos");
});
test("history labels only final calibrated-family practice results, retaining zero and separate scales", () => {
  const det = { scoringVersion: "verbo-det-practice-v1", value: 0 };
  assert.deepEqual(practiceScore(det, "COMPLETED"), { value: "0", label: "Índice de práctica / 100" });
  assert.equal(practiceScore(det, "PENDING_REVIEW"), null);
  assert.equal(practiceScore(det, "IN_PROGRESS"), null);
  assert.deepEqual(practiceScore({ scoringVersion: "verbo-toefl-practice-v1", value: 4.5 }, "COMPLETED"), { value: "4.5", label: "Banda de práctica / 6" });
  for (const score of [null, { value: 90 }, { scoringVersion: "official", value: 100 }, { ...det, value: 101 }, { ...det, value: NaN }, { scoringVersion: "verbo-toefl-practice-v1", value: 7 }]) assert.equal(practiceScore(score, "COMPLETED"), null);
});
test("profile accepts international names, trims boundaries and rejects controls or excessive lengths", () => {
  assert.equal(profileNameZ.parse("  María José O'Neill  "), "María José O'Neill");
  assert.equal(profileNameZ.parse("李 小龍"), "李 小龍");
  for (const name of [" ", "a", "Ada\nLovelace", "Ada\u0000Lovelace", "x".repeat(101)]) assert.equal(profileNameZ.safeParse(name).success, false);
});
test("activity dates use Mexico City midnight boundaries rather than the host timezone", () => {
  const date = portalDate(new Date("2026-10-25T03:00:00Z"), true);
  assert.match(date, /24/); assert.match(date, /oct/); assert.match(date, /2026/);
});
