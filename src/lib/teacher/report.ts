import { z } from "zod";
import { skills } from "../study-plan";

const note = z.string().trim().max(4000);
export const reportContentZ = z.object({
  summary: note, strengths: note, improvements: note, studyPlan: note,
  reading: note, listening: note, writing: note, speaking: note,
  focusSkills: z.array(z.enum(skills)).max(2).refine(v => new Set(v).size === v.length),
  followUpDate: z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => {
    const date = new Date(v + "T12:00:00Z");
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === v;
  })]),
}).strict();
export type ReportContent = z.infer<typeof reportContentZ>;
const publishedZ = z.object({ content: reportContentZ, authorName: z.string(), publishedAt: z.string().datetime(), overallScore: z.unknown(), subscores: z.unknown() });
export const teacherReportZ = z.object({ version: z.literal(1), revision: z.number().int().nonnegative(), draft: reportContentZ, published: publishedZ.nullable() });
export type TeacherReport = z.infer<typeof teacherReportZ>;
export type PublishedReport = z.infer<typeof publishedZ>;
export function readTeacherReport(value: unknown): TeacherReport | null {
  const result = teacherReportZ.safeParse(value);
  return result.success ? result.data : null;
}
export function publishedTeacherReport(value: unknown): PublishedReport | null { return readTeacherReport(value)?.published ?? null; }
export function reportPublicationError(content: ReportContent, attemptStatus: string) {
  if (attemptStatus !== "COMPLETED") return "Termina de evaluar las respuestas antes de publicar el reporte.";
  if ([content.summary, content.strengths, content.improvements, content.studyPlan].some(v => v.length < 10)) return "Completa el resumen, las fortalezas, las áreas por reforzar y el plan con al menos 10 caracteres cada uno.";
  return null;
}
export const emptyReport: ReportContent = { summary: "", strengths: "", improvements: "", studyPlan: "", reading: "", listening: "", writing: "", speaking: "", focusSkills: [], followUpDate: "" };
