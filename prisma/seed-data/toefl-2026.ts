import type { AdminField, ExamSeed, QuestionTypeSeed } from "./types";
import { TOEFL_FORMAT } from "../../src/lib/toefl-format";

const text = (key: string, label: string, required = true): AdminField => ({ key, label, type: "textarea", target: "prompt", required });
const options: AdminField = { key: "options", label: "Opciones", type: "options", target: "prompt", required: true, withCorrect: true };
const audio: AdminField = { key: "audioUrl", label: "Audio", type: "audio", target: "prompt", required: true };
const internalTranscript: AdminField = { key: "transcript", label: "Transcripción para revisión", type: "textarea", target: "prompt", studentHidden: true };

function choice(name: string, skill: "Reading" | "Listening"): QuestionTypeSeed {
  return {
    name, inputMedia: skill === "Reading" ? "TEXT" : "AUDIO", responseType: "MULTIPLE_CHOICE",
    timingMode: "PER_SECTION", ...(skill === "Listening" ? { replaysAllowed: 1 } : {}),
    isScored: true, subscoreMapping: [skill],
    adminFieldSchema: { version: 1, fields: skill === "Reading"
      ? [text("title", "Título", false), text("passage", "Texto"), text("question", "Pregunta"), options]
      : [audio, internalTranscript, text("context", "Contexto", false), text("question", "Pregunta"), options] },
  };
}

export const toeflSeed: ExamSeed = {
  name: "TOEFL iBT", slug: "toefl-ibt",
  description: "Práctica TOEFL iBT 2026: Reading, Listening, Writing y Speaking, con los doce tipos de tarea del formato vigente.",
  totalDurationMinutes: 120, sectionOrderMode: "FIXED", hasAdaptiveLogic: true,
  subscoreDefinitions: ["Reading", "Listening", "Writing", "Speaking"],
  scoreScale: { min: 1, max: 6, step: 0.5, label: "Resultado de práctica", calibrated: false,
    subscale: { min: 1, max: 6, step: 0.5 } },
  themeConfig: {
    examInterface: "toefl", formatVersion: TOEFL_FORMAT.version, officialSources: [...TOEFL_FORMAT.sources],
    palette: { bg: "#F4F6FA", surface: "#FFFFFF", ink: "#182438", inkMuted: "#5A677C",
      accent: "#2455A6", accentStrong: "#173D7C", line: "#DCE3ED", warning: "#B74116" },
    timer: { style: "clock", position: "top-bar", warnUnderSeconds: 60 },
    layout: { questionMaxWidth: 1120, split: true, splitRatio: [50, 50] },
    progress: { mode: "counter" }, navigation: { allowBack: true }, showStepper: true,
    typography: { display: "Arial", body: "Arial", serifTitles: false },
    style: { radius: 8, controlRadius: 6, transition: "instant", stepperStyle: "hairline" },
    disclaimer: "",
  },
  versions: [
    { label: "Diagnóstico", hasFeedback: false, isPublished: true },
    { label: "Simulador 1", hasFeedback: true, isPublished: false },
    { label: "Simulador 2", hasFeedback: true, isPublished: false },
    { label: "Simulador 3", hasFeedback: true, isPublished: false },
  ],
  sections: [
    { name: "Reading", order: 1, durationMinutes: 30, skillsMeasured: ["READING"], questionTypes: [
      { name: "Complete the Words", inputMedia: "TEXT", responseType: "FILL_BLANK", timingMode: "PER_SECTION",
        isScored: true, subscoreMapping: ["Reading"], adminFieldSchema: { version: 1, fields: [
          text("text", "Texto con letras faltantes"),
          { key: "answers", label: "Letras faltantes en orden", type: "list", target: "answer", required: true },
        ] } },
      choice("Read in Daily Life", "Reading"), choice("Read an Academic Passage", "Reading"),
    ] },
    { name: "Listening", order: 2, durationMinutes: 29, skillsMeasured: ["LISTENING"], questionTypes: [
      choice("Listen and Choose a Response", "Listening"), choice("Listen to a Conversation", "Listening"),
      choice("Listen to an Announcement", "Listening"), choice("Listen to an Academic Talk", "Listening"),
    ] },
    { name: "Writing", order: 3, durationMinutes: 23, skillsMeasured: ["WRITING"], questionTypes: [
      { name: "Build a Sentence", inputMedia: "TEXT", responseType: "DRAG_SELECT", timingMode: "PER_SECTION",
        isScored: true, subscoreMapping: ["Writing"], adminFieldSchema: { version: 1,
          timingGroup: { key: "build-a-sentence", durationSeconds: 360 }, fields: [
            text("question", "Contexto o pregunta"),
            { key: "wordBank", label: "Grupos de palabras", type: "list", target: "prompt", required: true },
            { key: "slots", label: "Número de espacios", type: "number", target: "prompt", required: true },
            { key: "order", label: "Índices correctos, desde 0, en orden", type: "list", target: "answer", required: true },
          ] } },
      { name: "Write an Email", inputMedia: "TEXT", responseType: "FREE_TEXT", timingMode: "PER_QUESTION",
        timePerItemSeconds: 420, isScored: true, subscoreMapping: ["Writing"], adminFieldSchema: { version: 1, fields: [
          text("scenario", "Situación y destinatario"),
          { key: "requiredPoints", label: "Puntos a cubrir", type: "list", target: "prompt", required: true },
        ] } },
      { name: "Write for an Academic Discussion", inputMedia: "TEXT", responseType: "FREE_TEXT", timingMode: "PER_QUESTION",
        timePerItemSeconds: 600, isScored: true, subscoreMapping: ["Writing"], adminFieldSchema: { version: 1, fields: [
          text("professorPost", "Pregunta del profesor"),
          { key: "studentReplies", label: "Respuestas de estudiantes", type: "repeater", target: "prompt", required: true,
            itemFields: [{ key: "author", label: "Nombre", type: "text", target: "prompt", required: true }, text("text", "Respuesta")] },
          { key: "minWords", label: "Referencia de palabras recomendadas", type: "number", target: "prompt" },
        ] } },
    ] },
    { name: "Speaking", order: 4, durationMinutes: 8, skillsMeasured: ["SPEAKING"], questionTypes: [
      { name: "Listen and Repeat", inputMedia: "AUDIO", responseType: "AUDIO_RECORDING", timingMode: "PER_QUESTION",
        timePerItemSeconds: 12, replaysAllowed: 1, isScored: true, subscoreMapping: ["Speaking"],
        adminFieldSchema: { version: 1, fields: [audio, internalTranscript,
          { key: "context", label: "Situación", type: "text", target: "prompt" }] } },
      { name: "Take an Interview", inputMedia: "CONVERSATION", responseType: "AUDIO_RECORDING", timingMode: "PER_QUESTION",
        timePerItemSeconds: 45, replaysAllowed: 1, isScored: true, subscoreMapping: ["Speaking"],
        adminFieldSchema: { version: 1, fields: [audio, internalTranscript,
          { key: "topicLabel", label: "Tema interno", type: "text", target: "prompt", studentHidden: true }] } },
    ] },
  ],
};
