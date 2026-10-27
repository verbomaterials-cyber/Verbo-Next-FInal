import { TOEFL_FORM_IDS, type DeliveryMetadata } from "../../src/lib/toefl-delivery";
export type FormQuestion = { key: string; questionType: string; prompt: Record<string, unknown>; answer: Record<string, unknown> | null; feedback: string; difficulty: number };
export type Choice = [question: string, correct: string, distractor1: string, distractor2: string, distractor3: string, explanation: string];
export type AudioScript = { id: string; turns: { voice: number; text: string }[] };

/** Each authored form owns its state; importing another form cannot append to it. */
export function createForm(formNumber: 1 | 2 | 3) {
  const formQuestions: FormQuestion[] = [];
  const audioScripts: AudioScript[] = [];
  let current: Pick<DeliveryMetadata, "section" | "module"> = { section: "Reading", module: "router" };
  let listeningIndex = 0;
  const idFor = (key: string) => formNumber === 1 ? key : `f${formNumber}-${key}`;
  function module(section: DeliveryMetadata["section"], stage: DeliveryMetadata["module"]) { current = { section, module: stage }; listeningIndex = 0; }
  function append(key: string, questionType: string, prompt: Record<string, unknown>, answer: Record<string, unknown> | null,
    feedback: string, difficulty: number, extra: Partial<DeliveryMetadata> = {}) {
    const meta: DeliveryMetadata = { formId: TOEFL_FORM_IDS[formNumber - 1], ...current, scored: true, ...extra };
    if (current.section === "Listening") {
      const unscored = current.module === "router" ? [1, 4, 7, 10, 13, 16, 19] : [1, 5, 9, 13, 17];
      meta.scored = !unscored.includes(listeningIndex++);
    }
    formQuestions.push({ key: idFor(key), questionType, prompt: { ...prompt, __delivery: meta }, answer, feedback, difficulty });
  }
  function choices(key: string, type: string, prompt: Record<string, unknown>, items: Choice[], difficulty: number, stimulusId?: string) {
    items.forEach(([question, correct, ...rest], index) => {
      const explanation = rest.pop()!;
      const options = [correct, ...rest];
      const offset = [...`${key}-${index}`].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % 4;
      const rotated = options.slice(offset).concat(options.slice(0, offset));
      append(`${key}-${index + 1}`, type, { ...prompt, question, options: rotated }, { options: rotated.indexOf(correct) }, explanation, difficulty, { stimulusId });
    });
  }
  function cloze(key: string, text: string, difficulty: number) {
    const answers = [...text.matchAll(/\[([^\]]+)\]/g)].map((match) => match[1]);
    append(key, "Complete the Words", { text }, { answers }, `Complete words: ${text.match(/\b\w+\[[^\]]+\]/g)?.map((word) => word.replace(/[\[\]]/g, "")).join(", ")}. Use the surrounding grammar and the paragraph's meaning.`, difficulty, { scoredBlanks: [0, 2, 4, 6, 8] });
  }
  function listen(key: string, type: string, turns: AudioScript["turns"], items: Choice[], difficulty: number) {
    audioScripts.push({ id: idFor(key), turns });
    choices(key, type, { audioUrl: `/audio/toefl-2026/form-${formNumber}/${idFor(key)}.wav`, transcript: turns.map((t) => t.text).join("\n"), context: type === "Listen to a Conversation" ? "Listen to two people speaking." : type === "Listen to an Academic Talk" ? "Listen to part of a class lecture." : undefined }, items, difficulty, idFor(key));
  }
  function addLinear(key: string, type: string, prompt: Record<string, unknown>, answer: Record<string, unknown> | null, feedback: string, difficulty: number, responseSeconds?: number) {
    append(key, type, prompt, answer, feedback, difficulty, { responseSeconds });
  }
  function spoken(key: string, type: "Listen and Repeat" | "Take an Interview", transcript: string, context: string, difficulty: number, seconds: number) {
    audioScripts.push({ id: idFor(key), turns: [{ voice: type === "Take an Interview" ? 1 : 0, text: transcript }] });
    addLinear(key, type, { audioUrl: `/audio/toefl-2026/form-${formNumber}/${idFor(key)}.wav`, transcript,
      ...(type === "Listen and Repeat" ? { context } : { topicLabel: context }) }, null,
      type === "Listen and Repeat" ? "Evaluate completeness, accurate wording and intelligibility using the 0–5 repetition rubric. Accent alone is not an error." : "Evaluate a direct, developed response, coherence, fluency, grammar, vocabulary and intelligibility using the 0–5 interview rubric.", difficulty, seconds);
  }
  return { formQuestions, audioScripts, module, choices, cloze, listen, addLinear, spoken };
}
