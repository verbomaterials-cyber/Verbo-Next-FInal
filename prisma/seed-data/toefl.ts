import type { ExamSeed } from "./types";
export { toeflSeed } from "./toefl-2026";

/*
 * Catálogo estilo TOEFL iBT 2026: 4 secciones en orden fijo (FIXED),
 * adaptativo por módulos (informativo por ahora), banda 1.0–6.0
 * + total 0–120, subscores por sección.
 */
export const legacyToeflSeed: ExamSeed = {
  name: "TOEFL iBT",
  slug: "toefl-ibt",
  description:
    "Simulador estilo TOEFL iBT 2026: cuatro secciones en orden fijo, ritmo académico formal y presión de tiempo real.",
  totalDurationMinutes: 116,
  sectionOrderMode: "FIXED",
  hasAdaptiveLogic: true,
  subscoreDefinitions: ["Reading", "Listening", "Speaking", "Writing"],
  scoreScale: {
    type: "band-and-total",
    band: { min: 1.0, max: 6.0, step: 0.5, label: "Banda TOEFL" },
    total: { min: 0, max: 120, label: "Puntaje total" },
    subscale: { min: 0, max: 30, step: 1, label: "Por sección" },
  },
  themeConfig: {
    // Identidad TOEFL: académica, editorial, con peso. Blanco puro,
    // azul marino profundo, líneas hairline y serif con carácter.
    palette: {
      bg: "#FFFFFF",
      surface: "#FFFFFF",
      ink: "#16202E",
      inkMuted: "#55606E",
      accent: "#1E3A5F", // azul marino profundo (no azul brillante de botón)
      accentStrong: "#14273F",
      line: "#E5E7EB",
      warning: "#C2410C",
    },
    timer: { style: "clock", position: "corner", warnUnderSeconds: 300 },
    layout: { questionMaxWidth: 980, split: true, splitRatio: [55, 45] },
    progress: { mode: "counter" },
    navigation: { allowBack: true },
    showStepper: true,
    typography: {
      display: "var(--font-toefl-display)",
      body: "var(--font-toefl-body)",
      serifTitles: true,
    },
    style: { radius: 10, controlRadius: 8, transition: "fade", stepperStyle: "hairline" },
    disclaimer: "Simulación de práctica — no afiliado a ETS.",
  },
  versions: [
    { label: "Diagnóstico", hasFeedback: false, isPublished: true },
    { label: "Simulador 1", hasFeedback: true, isPublished: true },
    { label: "Simulador 2", hasFeedback: true, isPublished: true },
    { label: "Simulador 3", hasFeedback: true, isPublished: true },
  ],
  sections: [
    {
      name: "Reading",
      order: 1,
      durationMinutes: 35,
      skillsMeasured: ["READING"],
      questionTypes: [
        {
          name: "Reading Comprehension",
          inputMedia: "TEXT",
          responseType: "MULTIPLE_CHOICE",
          timingMode: "PER_SECTION",
          isScored: true,
          subscoreMapping: ["Reading"],
          adminFieldSchema: {
            version: 1,
            fields: [
              {
                key: "passage",
                label: "Pasaje académico",
                type: "textarea",
                target: "prompt",
                required: true,
                help: "Se muestra a la izquierda en pantalla dividida; las preguntas a la derecha.",
              },
              { key: "question", label: "Pregunta", type: "textarea", target: "prompt", required: true },
              {
                key: "options",
                label: "Opciones",
                type: "options",
                target: "prompt",
                required: true,
                multiple: false,
                withCorrect: true,
              },
            ],
          },
        },
      ],
    },
    {
      name: "Listening",
      order: 2,
      durationMinutes: 36,
      skillsMeasured: ["LISTENING"],
      questionTypes: [
        {
          name: "Listening Comprehension",
          inputMedia: "AUDIO",
          responseType: "MULTIPLE_CHOICE",
          timingMode: "PER_SECTION",
          replaysAllowed: 1, // el TOEFL real reproduce el audio una sola vez
          isScored: true,
          subscoreMapping: ["Listening"],
          adminFieldSchema: {
            version: 1,
            fields: [
              {
                key: "audioUrl",
                label: "Audio (conferencia o conversación)",
                type: "audio",
                target: "prompt",
                required: true,
              },
              { key: "context", label: "Contexto breve en pantalla", type: "text", target: "prompt" },
              { key: "question", label: "Pregunta", type: "textarea", target: "prompt", required: true },
              {
                key: "options",
                label: "Opciones",
                type: "options",
                target: "prompt",
                required: true,
                multiple: false,
                withCorrect: true,
              },
            ],
          },
        },
      ],
    },
    {
      name: "Speaking",
      order: 3,
      durationMinutes: 16,
      skillsMeasured: ["SPEAKING"],
      questionTypes: [
        {
          name: "Interview Speaking",
          inputMedia: "CONVERSATION",
          responseType: "AUDIO_RECORDING",
          timingMode: "PER_QUESTION",
          timePerItemSeconds: 45, // formato 2026: sin preparación, 45 s de respuesta
          isScored: true,
          subscoreMapping: ["Speaking"],
          adminFieldSchema: {
            version: 1,
            fields: [
              {
                key: "audioUrl",
                label: "Audio de la pregunta del entrevistador",
                type: "audio",
                target: "prompt",
                required: true,
                help: "Formato 2026: la pregunta se escucha, no se lee. En pantalla solo se ve al entrevistador.",
              },
              {
                key: "topicLabel",
                label: "Tema (interno, no visible al alumno)",
                type: "text",
                target: "prompt",
                studentHidden: true,
              },
            ],
          },
        },
      ],
    },
    {
      name: "Writing",
      order: 4,
      durationMinutes: 29,
      skillsMeasured: ["WRITING"],
      questionTypes: [
        {
          name: "Academic Discussion",
          inputMedia: "TEXT",
          responseType: "FREE_TEXT",
          timingMode: "PER_QUESTION",
          timePerItemSeconds: 600,
          isScored: true,
          subscoreMapping: ["Writing"],
          adminFieldSchema: {
            version: 1,
            fields: [
              { key: "professorPost", label: "Publicación del profesor", type: "textarea", target: "prompt", required: true },
              {
                key: "studentReplies",
                label: "Respuestas de otros estudiantes",
                type: "repeater",
                target: "prompt",
                required: true,
                itemFields: [
                  { key: "author", label: "Nombre del estudiante", type: "text", target: "prompt", required: true },
                  { key: "text", label: "Respuesta", type: "textarea", target: "prompt", required: true },
                ],
              },
              { key: "minWords", label: "Mínimo de palabras", type: "number", target: "prompt" },
            ],
          },
        },
        {
          name: "Write an Email",
          inputMedia: "TEXT",
          responseType: "FREE_TEXT",
          timingMode: "PER_QUESTION",
          timePerItemSeconds: 540,
          isScored: true,
          subscoreMapping: ["Writing"],
          adminFieldSchema: {
            version: 1,
            fields: [
              { key: "scenario", label: "Situación y destinatario", type: "textarea", target: "prompt", required: true },
              {
                key: "requiredPoints",
                label: "Puntos que debe cubrir el correo",
                type: "list",
                target: "prompt",
              },
              { key: "minWords", label: "Mínimo de palabras", type: "number", target: "prompt" },
            ],
          },
        },
      ],
    },
  ],
};
