import { DET_FORMAT, type DetMeta } from "../../src/lib/det-format";
import type { DetQuestion } from "./form-1";

export type ReadingSet = {
  title: string; opening: string; gaps: [string, string, string][]; bridge: string; ending: string;
  distractors: string[]; highlights: [string, string][]; idea: string[]; titles: string[];
};
export type ListeningSet = {
  scenario: string; blanks: string[]; accepted: string[][]; turns: [string, string[], number][];
};
export type FormContent = {
  id: "diagnostic" | "2" | "3"; label: string; feedback: boolean;
  words: [string, string, string][]; sentences: [string, string, string][];
  passages: [string, string, string][]; dictations: [string, string, string][];
  reading: ReadingSet[]; listening: ListeningSet[]; writing: [string, string];
  readSpeak: string; interview: string[]; writingSample: string; speakingSample: string;
  photos: [string, string, string, string];
};

export function buildDetForm(data: FormContent) {
  const questions: DetQuestion[] = [];
  const audioScripts: { id: string; text: string; speaker: number }[] = [];
  const audio = (id: string, text: string, speaker = 0) => {
    const path = `form-${data.id}/${id}`;
    audioScripts.push({ id: path, text, speaker });
    return `/audio/det-2026/${path}.wav`;
  };
  function add(key: string, type: string, task: DetMeta["task"], skill: DetMeta["skill"], seconds: number,
    prompt: Record<string, unknown>, answer: DetQuestion["answer"], extra: Partial<DetMeta> = {}, feedback?: string) {
    questions.push({ key, type, prompt: { ...prompt, _det: { format: DET_FORMAT.version, key, task, skill, seconds, prep: 0, ...extra } },
      answer, difficulty: extra.level ?? 3, feedback: feedback ?? "Revisa con tu asesor la pertinencia, el desarrollo y la precisión de tu respuesta." });
  }
  const levels = [1, 3, 5] as const;
  const letters = (kind: "blank" | "complete", i: number) => {
    (kind === "blank" ? data.sentences : data.passages)[i].forEach((text, j) => add(`${kind}-${i+1}-${j}`,
      kind === "blank" ? "Fill in the Blanks" : "Read and Complete", "letters", "Reading", kind === "blank" ? 20 : 180,
      { instruction: kind === "blank" ? "Complete the sentence with the correct word." : "Type the missing letters to complete the text below.", text },
      { answers: [...text.matchAll(/\[([^\]]+)\]/g)].map(m => m[1]) }, { slot: `${kind}-${i+1}`, level: levels[j] },
      `Palabras completas: ${text.replace(/\[([^\]]+)\]/g, "$1")}`));
  };
  // Each form has its own 31 short-task slots, with three editorial levels per slot.
  for (let block = 0; block < 3; block++) {
    for (let n = 0; n < (block === 2 ? 6 : 5); n++) {
      const i = block * 5 + n;
      data.words[i].forEach((text, j) => {
        const real = !text.startsWith("!"); const word = text.replace(/^!/, "");
        add(`word-${i+1}-${j}`, "Read and Select", "word", "Reading", 5,
          { instruction: "Is this a real English word?", text: word, options: { options: ["Yes", "No"] } }, { options: real ? 0 : 1 },
          { slot: `word-${i+1}`, level: levels[j] }, real ? `${word} is an English word.` : `${word} is not a standard English word.`);
      });
    }
    for (let n = 0; n < 2; n++) {
      const i = block * 2 + n;
      letters("blank", i);
      data.dictations[i].forEach((text, j) => add(`dictation-${i+1}-${j}`, "Listen and Type", "dictation", "Listening", 60,
        { instruction: "Type the statement that you hear.", audioUrl: audio(`dictation-${i+1}-${j}`, text, j % 2) },
        { transcript: text }, { slot: `dictation-${i+1}`, level: levels[j] }, `Transcripción: ${text}`));
      if (n === 0) letters("complete", block);
    }
  }
  data.reading.forEach((r, i) => {
    const set = `reading-${i+1}`, group = { key: set, seconds: 420 };
    const passage = `${r.opening}\n\n${r.bridge}\n\n${r.ending}`;
    let cloze = r.opening;
    r.gaps.forEach(([word], n) => {
      const at = cloze.indexOf(word);
      if (at < 0) throw new Error(`${data.id}: Missing reading word ${word}`);
      cloze = cloze.slice(0, at) + `___${n}___` + cloze.slice(at + word.length);
    });
    const blanks = r.gaps.map(([word, a, b], n) => {
      const options = [a, b]; options.splice(n % 3, 0, word); return { options };
    });
    add(`${set}-words`, "Interactive Reading: Complete the Sentences", "reading-words", "Reading", 420,
      { instruction: "Select the best option for each missing word.", title: r.title, passage: cloze, blanks },
      { choices: r.gaps.map((_, n) => n % 3) }, { group, set, step: 1 }, `Pasaje completo: ${r.opening}`);
    const options = [...r.distractors]; options.splice((i + 1) % 4, 0, r.bridge);
    add(`${set}-sentence`, "Interactive Reading: Complete the Passage", "reading-sentence", "Reading", 420,
      { instruction: "Select the best sentence to fill in the blank.", title: r.title, passage: `${r.opening}\n\n[ … ]\n\n${r.ending}`, options: { options } },
      { options: (i + 1) % 4 }, { group, set, step: 2 }, `La oración enlaza ambos párrafos: ${r.bridge}`);
    r.highlights.forEach(([text, target], n) => {
      const tokens = passage.split(/\s+/), words = target.split(/\s+/);
      const start = tokens.findIndex((_, at) => tokens.slice(at, at + words.length).join(" ") === target);
      if (start < 0) throw new Error(`${data.id}: Missing highlight ${target}`);
      add(`${set}-highlight-${n+1}`, "Interactive Reading: Highlight the Answer", "highlight", "Reading", 420,
        { instruction: "Highlight text in the passage to answer the question below.", title: r.title, passage, text },
        { start, end: start + words.length - 1 }, { group, set, step: n + 3 }, `La evidencia exacta es: ${target}`);
    });
    add(`${set}-idea`, "Interactive Reading: Identify the Idea", "choice", "Reading", 420,
      { instruction: "Select the idea that is expressed in the passage.", title: r.title, passage, options: { options: r.idea } },
      { options: 0 }, { group, set, step: 5 }, r.idea[0]);
    add(`${set}-title`, "Interactive Reading: Title the Passage", "choice", "Reading", 420,
      { instruction: "Select the best title for the passage.", passage, options: { options: r.titles } },
      { options: 2 }, { group, set, step: 6 }, r.titles[2]);
  });
  data.listening.forEach((l, i) => {
    const set = `listening-${i+1}`, group = { key: set, seconds: 390 }, scenarioAudio = audio(`${set}-scenario`, l.scenario, i % 2);
    add(`${set}-complete`, "Interactive Listening: Listen and Complete", "listen-complete", "Listening", 390,
      { instruction: "Listen to the scenario and complete the sentences.", audioUrl: scenarioAudio, blanks: l.blanks.map(text => ({ text })) },
      { accepted: l.accepted }, { group, set, step: 1, scenarioAudio }, `Datos clave: ${l.accepted.map(a => a[0]).join("; ")}.`);
    l.turns.forEach(([text, options, correct], n) => add(`${set}-respond-${n+1}`, "Interactive Listening: Listen and Respond", "listen-respond", "Listening", 390,
      { instruction: "Select the best response to continue the conversation.", audioUrl: audio(`${set}-turn-${n+1}`, text, 1 - i % 2), options: { options }, _transcript: text },
      { options: correct }, { group, set, step: n + 2, scenarioAudio }, `Respuesta que mantiene el propósito y el contexto: ${options[correct]}`));
    add(`${set}-summary`, "Interactive Listening: Summarize the Conversation", "summary", "Writing", 75,
      { instruction: "Write a summary of the conversation you just had.", text: "Include who was speaking, the problem, and the outcome. Write a connected paragraph." }, null, { set, step: 7 });
  });
  data.photos.slice(0, 3).forEach((name, i) => add(`photo-write-${i+1}`, "Write About the Photo", "photo-write", "Writing", 60,
    { instruction: "Write one or more sentences that describe the image below.", imageUrl: `/images/det-2026/${name}.jpg`, imageAlt: `Practice photograph ${i+1}` }, null));
  data.writing.forEach((text, i) => add(`writing-${i+1}`, "Interactive Writing", "writing", "Writing", i ? 180 : 300,
    { instruction: i ? "Write a follow-up response for 3 minutes." : "Write about the topic below for 5 minutes.", text }, null,
    { prep: i ? 0 : 30, set: "writing", step: i + 1, ...(i ? { previousKey: "writing-1" } : {}) }));
  add("photo-speak", "Speak About the Photo", "photo-speak", "Speaking", 90,
    { instruction: "Speak about the image below.", imageUrl: `/images/det-2026/${data.photos[3]}.jpg`, imageAlt: "Practice photograph for speaking" }, null, { prep: 20 });
  add("read-speak", "Read, Then Speak", "read-speak", "Speaking", 90, { instruction: "Speak about the topic below.", text: data.readSpeak }, null, { prep: 20 });
  data.interview.forEach((text, i) => add(`interview-${i+1}`, "Interactive Speaking", "interview", "Speaking", 35,
    { instruction: "Listen to the question, then record your answer.", audioUrl: audio(`interview-${i+1}`, text, 1), _transcript: text }, null, { set: "speaking", step: i + 1 }));
  add("writing-sample", "Writing Sample", "writing-sample", "Writing", 300, { instruction: "Write about the topic below for 5 minutes.", text: data.writingSample }, null, { prep: 30 });
  add("speaking-sample", "Speaking Sample", "speaking-sample", "Speaking", 180, { instruction: "Speak about the topic below.", text: data.speakingSample }, null, { prep: 30 });
  return { id: data.id, label: data.label, hasFeedback: data.feedback, questions, audioScripts, deliveredScreens: 72 };
}
