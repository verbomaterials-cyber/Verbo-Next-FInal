import { z } from "zod";

export const TOEFL_FORM_ID = "verbo-toefl-2026-form-1-v1";
export const TOEFL_FORM_IDS = [TOEFL_FORM_ID, "verbo-toefl-2026-form-2-v1", "verbo-toefl-2026-form-3-v1"] as const;
export const PRACTICE_ROUTING_THRESHOLD = 0.65;
export const deliveryMetadataZ = z.object({
  formId: z.enum(TOEFL_FORM_IDS),
  module: z.enum(["router", "lower", "upper", "linear"]),
  section: z.enum(["Reading", "Listening", "Writing", "Speaking"]),
  stimulusId: z.string().optional(),
  responseSeconds: z.number().int().positive().optional(),
  scored: z.boolean().default(true),
  scoredBlanks: z.array(z.number().int().nonnegative()).optional(),
});
export type DeliveryMetadata = z.infer<typeof deliveryMetadataZ>;
export function deliveryMetadata(prompt: unknown): DeliveryMetadata | null {
  const parsed = deliveryMetadataZ.safeParse((prompt as Record<string, unknown> | null)?.__delivery);
  return parsed.success ? parsed.data : null;
}
export type RouteDecision = { branch: "lower" | "upper"; earned: number; possible: number; threshold: number };
export function delivered(metadata: DeliveryMetadata | null, routes: Record<string, RouteDecision>): boolean {
  return !metadata || metadata.module === "linear" || metadata.module === "router" || routes[metadata.section]?.branch === metadata.module;
}
export function moduleSeconds(metadata: DeliveryMetadata): number | null {
  if (metadata.section === "Reading") return metadata.module === "router" ? 1260 : 540;
  if (metadata.section === "Listening") return metadata.module === "router" ? 1080 : metadata.module === "upper" ? 660 : 420;
  return null;
}
export function closedPoints(question: { responseType: string; correctAnswer: Record<string, unknown> | null; promptContent: Record<string, unknown> }, answer: Record<string, unknown> | undefined): { earned: number; possible: number } {
  const meta = deliveryMetadata(question.promptContent);
  if (meta?.scored === false) return { earned: 0, possible: 0 };
  if (question.responseType === "FILL_BLANK") {
    const expected = question.correctAnswer?.answers as string[] | undefined;
    if (!expected) return { earned: 0, possible: 0 };
    const positions = meta?.scoredBlanks ?? expected.map((_, index) => index);
    const got = Array.isArray(answer?.answers) ? answer.answers : [];
    return { possible: positions.length, earned: positions.filter((index) =>
      typeof got[index] === "string" && String(got[index]).trim().toLowerCase() === expected[index].trim().toLowerCase()).length };
  }
  return { possible: 1, earned: answer?.options === question.correctAnswer?.options && typeof answer?.options === "number" ? 1 : 0 };
}
