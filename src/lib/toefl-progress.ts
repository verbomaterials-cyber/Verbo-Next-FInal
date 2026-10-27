import { z } from "zod";
export const progressSections = ["Reading", "Listening", "Writing", "Speaking"] as const;
export type ProgressSection = typeof progressSections[number];
const points = (possible: number) => z.object({ earned: z.number().min(0).max(possible), possible: z.literal(possible), pending: z.number().int().nonnegative() });
const scoreZ = z.object({ scoringVersion: z.literal("verbo-toefl-practice-v1"), calibrated: z.literal(false), value: z.number().min(1).max(6).nullable(),
  raw: z.object({ Reading: points(35), Listening: points(35), Writing: points(20), Speaking: points(55) }),
  routes: z.record(z.string(), z.object({ branch: z.enum(["lower", "upper"]) })).optional(),
});
export type ProgressAttempt = { id: string; status: string; completedAt: Date | null; startedAt: Date; overallScore: unknown; label: string };
export function buildToeflProgress(attempts: ProgressAttempt[]) {
  const history = attempts.filter((attempt) => ["COMPLETED", "PENDING_REVIEW"].includes(attempt.status))
    .map((attempt) => { const parsed = scoreZ.safeParse(attempt.overallScore); return { ...attempt, score: parsed.success ? parsed.data : null }; })
    .sort((a, b) => (a.completedAt ?? a.startedAt).getTime() - (b.completedAt ?? b.startedAt).getTime() || a.id.localeCompare(b.id));
  const comparable = history.filter((attempt) => attempt.score !== null);
  const completed = comparable.filter((attempt) => attempt.status === "COMPLETED" && attempt.score?.value !== null && progressSections.every((section) => attempt.score!.raw[section].pending === 0));
  const first = completed[0] ?? null;
  const latest = completed.at(-1) ?? null;
  const changes = progressSections.map((section) => {
    const start = first?.score?.raw[section], end = latest?.score?.raw[section];
    return { section, first: start?.earned ?? null, latest: end?.earned ?? null, possible: end?.possible ?? null,
      delta: start && end && completed.length > 1 ? end.earned - start.earned : null };
  });
  return { history, comparable, completed, first, latest, changes,
    pending: comparable.filter((attempt) => attempt.status === "PENDING_REVIEW").length };
}
