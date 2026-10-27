import { z } from "zod";

export const DET_FORMAT = {
  version: "det-2026-10-25", verifiedOn: "2026-10-25", minutes: 60, practiceScreens: 72,
  sources: [
    "https://testcenter.zendesk.com/hc/en-us/articles/39104891663245-Test-Structure",
    "https://testcenter.zendesk.com/hc/en-us/articles/36094897057421-Test-Update-New-Interactive-Speaking-questions",
    "https://testcenter.zendesk.com/hc/en-us/articles/36094888038029-Test-Update-Expanded-Interactive-Listening-question",
    "https://testcenter.zendesk.com/hc/en-us/articles/39104638598797-Interactive-Writing",
    "https://testcenter.zendesk.com/hc/en-us/articles/39104960626189-How-the-Items-Are-Scored",
  ],
} as const;

export const detMetaZ = z.object({
  format: z.literal(DET_FORMAT.version), key: z.string(), task: z.enum([
    "word", "letters", "dictation", "reading-words", "reading-sentence", "highlight", "choice",
    "listen-complete", "listen-respond", "summary", "photo-write", "writing", "photo-speak", "read-speak", "interview", "writing-sample", "speaking-sample",
  ]), skill: z.enum(["Reading", "Listening", "Writing", "Speaking"]),
  seconds: z.number().int().positive(), prep: z.number().int().nonnegative().default(0),
  group: z.object({ key: z.string(), seconds: z.number().int().positive() }).optional(),
  slot: z.string().optional(), level: z.union([z.literal(1), z.literal(3), z.literal(5)]).optional(),
  previousKey: z.string().optional(), scenarioAudio: z.string().optional(), set: z.string().optional(), step: z.number().int().optional(),
});
export type DetMeta = z.infer<typeof detMetaZ>;
export function detDelivered(meta: DetMeta | null, questionId: string, selections: Record<string,string>) {
  return !meta?.slot || (selections[meta.slot] ? selections[meta.slot] === questionId : meta.level === 3);
}
export function detMetadata(value: unknown): DetMeta | null {
  const result = detMetaZ.safeParse((value as { _det?: unknown } | null)?._det);
  return result.success ? result.data : null;
}
export const DET_RUBRIC_VERSION = "verbo-det-holistic-v1";
export function detSolutionAnswer(correct: Record<string,unknown>) {
  if(typeof correct.transcript==="string")return{text:correct.transcript};
  if(Array.isArray(correct.accepted))return{answers:correct.accepted.map((variants)=>Array.isArray(variants)?variants[0]:"")};
  return correct;
}
export const detAssessmentZ = z.object({ version: z.literal(DET_RUBRIC_VERSION), task: z.string(), score: z.number().int().min(0).max(5), source: z.enum(["teacher", "missing"]) });
export const detRubric = {
  criteria: ["Pertinencia, desarrollo y cumplimiento del encargo", "Variedad y precisión de vocabulario y gramática", "Organización y cohesión al escribir; fluidez e inteligibilidad al hablar"],
  levels: ["Sin respuesta evaluable o fuera de tema.", "Producción mínima; el significado resulta difícil de recuperar.", "Respuesta limitada; errores y omisiones dificultan la comunicación.", "Respuesta pertinente y comprensible con desarrollo y control desiguales.", "Respuesta clara y desarrollada, con lenguaje variado y errores menores.", "Respuesta completa, coherente y precisa; amplio control lingüístico e inteligibilidad."],
};
export const detListeningRubric = {
  criteria: ["Recuperación del significado de cada respuesta", "Aceptar paráfrasis correctas", "No penalizar errores menores de gramática, puntuación u ortografía que no cambien el significado"],
  levels: ["Sin información correcta recuperable.", "Solo un fragmento mínimo de información pertinente.", "Parte de la información es correcta, con omisiones importantes.", "Recupera una parte sustancial del significado; faltan datos relevantes.", "Casi toda la información es correcta, con una omisión menor.", "Todas las respuestas comunican los datos solicitados, incluidas paráfrasis válidas."],
};
const normalize = (text: unknown) => String(text ?? "").normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, "").trim().replace(/\s+/g, " ");
export function detPoints(prompt: Record<string, unknown>, correct: Record<string, unknown> | null, answer: Record<string, unknown> = {}) {
  const meta = detMetadata(prompt);
  if (!meta || !correct) return { earned: 0, possible: 0 };
  if (Array.isArray(correct.answers)) {
    const given = Array.isArray(answer.answers) ? answer.answers : [];
    return { earned: correct.answers.reduce<number>((sum, expected, i) => sum + (normalize(expected) === normalize(given[i]) ? 1 : 0), 0), possible: correct.answers.length };
  }
  if (Array.isArray(correct.accepted)) {
    const given = Array.isArray(answer.answers) ? answer.answers : [];
    return { earned: correct.accepted.reduce<number>((sum, variants, i) => sum + (Array.isArray(variants) && variants.some((v) => normalize(v) === normalize(given[i])) ? 1 : 0), 0), possible: correct.accepted.length };
  }
  if (Array.isArray(correct.choices)) {
    const given = Array.isArray(answer.choices) ? answer.choices : [];
    return { earned: correct.choices.reduce<number>((sum, expected, i) => sum + (given[i] === expected ? 1 : 0), 0), possible: correct.choices.length };
  }
  if (typeof correct.options === "number") return { earned: correct.options === answer.options ? 1 : 0, possible: 1 };
  if (typeof correct.start === "number" && typeof correct.end === "number") {
    const start = answer.start, end = answer.end;
    if (!Number.isInteger(start) || !Number.isInteger(end) || Number(start) < 0 || Number(end) < Number(start)) return { earned: 0, possible: 1 };
    const overlap = Math.max(0, Math.min(correct.end, Number(end)) - Math.max(correct.start, Number(start)) + 1);
    return { earned: 2 * overlap / ((correct.end - correct.start + 1) + (Number(end) - Number(start) + 1)), possible: 1 };
  }
  if (typeof correct.transcript === "string") {
    const expected = normalize(correct.transcript).split(" "), given = normalize(answer.text).split(" ").filter(Boolean);
    // Practice word-level edit similarity; omissions and substitutions both lose credit.
    let row = Array.from({ length: given.length + 1 }, (_, i) => i);
    expected.forEach((word, i) => { const next = [i + 1]; given.forEach((got, j) => next.push(Math.min(next[j] + 1, row[j + 1] + 1, row[j] + (word === got ? 0 : 1)))); row = next; });
    return { earned: Math.max(0, 1 - row[given.length] / expected.length), possible: 1 };
  }
  return { earned: 0, possible: 0 };
}

/** Never project arbitrary metadata, transcripts, answer keys or future prompts. */
export function detPublicPrompt(prompt: Record<string, unknown>) {
  const result: Record<string, unknown> = {};
  for (const key of ["instruction", "text", "passage", "audioUrl", "imageUrl", "imageAlt", "options", "blanks", "title"] as const) {
    if (prompt[key] !== undefined) result[key] = key === "text" && typeof prompt[key] === "string"
      ? prompt[key].replace(/\[([^\]]+)\]/g, (_, text: string) => `[${"_".repeat(text.length)}]`) : key==="options" ? {options:(prompt.options as {options?:unknown}).options??[]} : key==="blanks" && Array.isArray(prompt.blanks) ? prompt.blanks.map(b=>({text:b.text,...(Array.isArray(b.options)?{options:b.options}:{})})) : prompt[key];
  }
  return result;
}
