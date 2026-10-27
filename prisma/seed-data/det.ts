import type { ExamSeed } from "./types";

/*
 * Catálogo estilo DET: tipos de pregunta intercalados (MIXED),
 * adaptativo (informativo por ahora), 8 subscores, escala 10–160.
 * Estructura real: Adaptive Test + Writing Sample + Speaking Sample.
 */
export const detSeed: ExamSeed = {
  name: "Duolingo English Test",
  slug: "det",
  description:
    "Simulador estilo DET: una pregunta a la vez, ritmo rápido, tipos de pregunta intercalados sin orden fijo.",
  totalDurationMinutes: 60,
  sectionOrderMode: "MIXED",
  hasAdaptiveLogic: true,
  subscoreDefinitions: [
    "Literacy",
    "Comprehension",
    "Conversation",
    "Production",
    "Reading",
    "Writing",
    "Listening",
    "Speaking",
  ],
  scoreScale: {
    type: "range",
    min: 10,
    max: 160,
    step: 5,
    label: "Puntaje DET",
  },
  themeConfig: {
    // Identidad DET: minimalista, rápida, casi lúdica. Blanco cálido,
    // menta para elementos activos, tarjetas muy redondeadas sin sombra.
    palette: {
      bg: "#FAFAF8",
      surface: "#FFFFFF",
      ink: "#18181B",
      inkMuted: "#52525B",
      accent: "#4ADE80", // menta: relleno de estados activos (texto oscuro encima)
      accentStrong: "#16A34A", // verde profundo: barras, bordes, foco
      line: "#ECECE8",
      warning: "#E8A13D",
    },
    timer: { style: "bar", position: "top-bar", warnUnderSeconds: 20 },
    layout: { questionMaxWidth: 720, split: false },
    progress: { mode: "ambiguous" },
    navigation: { allowBack: false },
    showStepper: false,
    typography: {
      display: "var(--font-det-display)",
      body: "var(--font-det-body)",
      serifTitles: false,
    },
    style: { radius: 28, controlRadius: 999, transition: "fade", stepperStyle: "dots" },
    disclaimer: "Simulación de práctica — no afiliado a Duolingo.",
  },
  versions: [
    { label: "Diagnóstico", hasFeedback: false, isPublished: true },
    { label: "Simulador 1", hasFeedback: true, isPublished: true },
    { label: "Simulador 2", hasFeedback: true, isPublished: true },
    { label: "Simulador 3", hasFeedback: true, isPublished: true },
  ],
  sections: [
    {
      name: "Adaptive Test",
      durationMinutes: 45,
      skillsMeasured: ["READING", "WRITING", "LISTENING", "SPEAKING"],
      questionTypes: [
        {
          name: "Read and Complete",
          inputMedia: "TEXT",
          responseType: "FILL_BLANK",
          timingMode: "PER_QUESTION",
          timePerItemSeconds: 180,
          isScored: true,
          subscoreMapping: ["Literacy", "Reading", "Writing"],
          adminFieldSchema: {
            version: 1,
            fields: [
              {
                key: "text",
                label: "Texto con palabras incompletas",
                type: "textarea",
                target: "prompt",
                required: true,
                help: "Marca las letras faltantes entre corchetes: 'The w[eather] was n[ice]'.",
              },
              {
                key: "answers",
                label: "Letras faltantes (en orden)",
                type: "list",
                target: "answer",
                required: true,
              },
            ],
          },
        },
        {
          name: "Read and Select",
          inputMedia: "TEXT",
          responseType: "MULTIPLE_CHOICE",
          timingMode: "PER_QUESTION",
          timePerItemSeconds: 60,
          isScored: true,
          subscoreMapping: ["Literacy", "Reading"],
          adminFieldSchema: {
            version: 1,
            fields: [
              {
                key: "words",
                label: "Palabras mostradas",
                type: "options",
                target: "prompt",
                required: true,
                multiple: true,
                withCorrect: true,
                help: "Marca como correctas las palabras reales en inglés; las demás son pseudo-palabras.",
              },
            ],
          },
        },
        {
          name: "Complete the Words",
          inputMedia: "TEXT",
          responseType: "FILL_BLANK",
          timingMode: "PER_QUESTION",
          timePerItemSeconds: 90,
          isScored: true,
          subscoreMapping: ["Literacy", "Reading"],
          adminFieldSchema: {
            version: 1,
            fields: [
              {
                key: "text",
                label: "Texto con palabras a completar",
                type: "textarea",
                target: "prompt",
                required: true,
                help: "Mismo formato de corchetes que Read and Complete.",
              },
              {
                key: "answers",
                label: "Letras faltantes (en orden)",
                type: "list",
                target: "answer",
                required: true,
              },
            ],
          },
        },
        {
          name: "Listen and Select",
          inputMedia: "AUDIO",
          responseType: "MULTIPLE_CHOICE",
          timingMode: "PER_QUESTION",
          timePerItemSeconds: 90,
          replaysAllowed: 3,
          isScored: true,
          subscoreMapping: ["Comprehension", "Listening"],
          adminFieldSchema: {
            version: 1,
            fields: [
              {
                key: "audioWords",
                label: "Palabras habladas",
                type: "repeater",
                target: "prompt",
                required: true,
                itemFields: [
                  { key: "audioUrl", label: "Audio", type: "audio", target: "prompt", required: true },
                  { key: "label", label: "Etiqueta interna", type: "text", target: "prompt" },
                ],
              },
              {
                key: "correctIndexes",
                label: "Índices de palabras reales",
                type: "list",
                target: "answer",
                required: true,
                help: "Posiciones (desde 0) de los audios que sí son palabras reales.",
              },
            ],
          },
        },
        {
          name: "Listen and Type",
          inputMedia: "AUDIO",
          responseType: "TYPE_TEXT",
          timingMode: "PER_QUESTION",
          timePerItemSeconds: 60,
          replaysAllowed: 3,
          isScored: true,
          subscoreMapping: ["Conversation", "Listening"],
          adminFieldSchema: {
            version: 1,
            fields: [
              { key: "audioUrl", label: "Audio del enunciado", type: "audio", target: "prompt", required: true },
              {
                key: "transcript",
                label: "Transcripción correcta",
                type: "text",
                target: "answer",
                required: true,
              },
            ],
          },
        },
        {
          name: "Read Aloud",
          inputMedia: "TEXT",
          responseType: "AUDIO_RECORDING",
          timingMode: "PER_QUESTION",
          timePerItemSeconds: 20,
          isScored: true,
          subscoreMapping: ["Comprehension", "Speaking"],
          adminFieldSchema: {
            version: 1,
            fields: [
              {
                key: "sentence",
                label: "Oración a leer en voz alta",
                type: "textarea",
                target: "prompt",
                required: true,
              },
            ],
          },
        },
        {
          name: "Write About the Photo",
          inputMedia: "IMAGE",
          responseType: "FREE_TEXT",
          timingMode: "PER_QUESTION",
          timePerItemSeconds: 60,
          isScored: true,
          subscoreMapping: ["Production", "Writing"],
          adminFieldSchema: {
            version: 1,
            fields: [
              { key: "imageUrl", label: "Fotografía", type: "image", target: "prompt", required: true },
            ],
          },
        },
        {
          name: "Speak About the Photo",
          inputMedia: "IMAGE",
          responseType: "AUDIO_RECORDING",
          timingMode: "PER_QUESTION",
          timePerItemSeconds: 90,
          prepTimeSeconds: 20,
          isScored: true,
          subscoreMapping: ["Production", "Speaking"],
          adminFieldSchema: {
            version: 1,
            fields: [
              { key: "imageUrl", label: "Fotografía", type: "image", target: "prompt", required: true },
            ],
          },
        },
        {
          name: "Read, Then Write",
          inputMedia: "TEXT",
          responseType: "FREE_TEXT",
          timingMode: "PER_QUESTION",
          timePerItemSeconds: 300,
          isScored: true,
          subscoreMapping: ["Production", "Writing"],
          adminFieldSchema: {
            version: 1,
            fields: [
              { key: "prompt", label: "Pregunta de escritura", type: "textarea", target: "prompt", required: true },
              {
                key: "minWords",
                label: "Mínimo de palabras",
                type: "number",
                target: "prompt",
                help: "El DET real pide al menos 50 palabras.",
              },
            ],
          },
        },
        {
          name: "Read, Then Speak",
          inputMedia: "TEXT",
          responseType: "AUDIO_RECORDING",
          timingMode: "PER_QUESTION",
          timePerItemSeconds: 90,
          prepTimeSeconds: 20,
          isScored: true,
          subscoreMapping: ["Production", "Conversation", "Speaking"],
          adminFieldSchema: {
            version: 1,
            fields: [
              { key: "prompt", label: "Pregunta a responder hablando", type: "textarea", target: "prompt", required: true },
            ],
          },
        },
        {
          name: "Listen, Then Speak",
          inputMedia: "AUDIO",
          responseType: "AUDIO_RECORDING",
          timingMode: "PER_QUESTION",
          timePerItemSeconds: 90,
          prepTimeSeconds: 20,
          replaysAllowed: 2,
          isScored: true,
          subscoreMapping: ["Conversation", "Listening", "Speaking"],
          adminFieldSchema: {
            version: 1,
            fields: [
              { key: "audioUrl", label: "Audio de la pregunta", type: "audio", target: "prompt", required: true },
            ],
          },
        },
        {
          name: "Interactive Reading",
          inputMedia: "TEXT",
          responseType: "MULTIPLE_CHOICE",
          timingMode: "PER_QUESTION",
          timePerItemSeconds: 480,
          isScored: true,
          subscoreMapping: ["Literacy", "Comprehension", "Reading"],
          adminFieldSchema: {
            version: 1,
            fields: [
              { key: "passage", label: "Pasaje", type: "textarea", target: "prompt", required: true },
              {
                key: "subQuestions",
                label: "Sub-preguntas",
                type: "repeater",
                target: "prompt",
                required: true,
                itemFields: [
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
            ],
          },
        },
        {
          name: "Interactive Listening",
          inputMedia: "CONVERSATION",
          responseType: "MULTIPLE_CHOICE",
          timingMode: "PER_QUESTION",
          timePerItemSeconds: 240,
          isScored: true,
          subscoreMapping: ["Comprehension", "Conversation", "Listening"],
          adminFieldSchema: {
            version: 1,
            fields: [
              { key: "scenario", label: "Contexto de la conversación", type: "textarea", target: "prompt", required: true },
              {
                key: "turns",
                label: "Turnos de la conversación",
                type: "repeater",
                target: "prompt",
                required: true,
                itemFields: [
                  { key: "audioUrl", label: "Audio del interlocutor", type: "audio", target: "prompt", required: true },
                  {
                    key: "options",
                    label: "Respuestas posibles",
                    type: "options",
                    target: "prompt",
                    required: true,
                    multiple: false,
                    withCorrect: true,
                  },
                ],
              },
            ],
          },
        },
      ],
    },
    {
      name: "Writing Sample",
      durationMinutes: 5,
      skillsMeasured: ["WRITING"],
      questionTypes: [
        {
          name: "Writing Sample",
          inputMedia: "TEXT",
          responseType: "FREE_TEXT",
          timingMode: "PER_QUESTION",
          timePerItemSeconds: 300,
          isScored: false, // se revisa en sesión en vivo, no lo califica el sistema
          subscoreMapping: [],
          adminFieldSchema: {
            version: 1,
            fields: [
              { key: "prompt", label: "Pregunta de escritura extendida", type: "textarea", target: "prompt", required: true },
            ],
          },
        },
      ],
    },
    {
      name: "Speaking Sample",
      durationMinutes: 3,
      skillsMeasured: ["SPEAKING"],
      questionTypes: [
        {
          name: "Speaking Sample",
          inputMedia: "TEXT",
          responseType: "AUDIO_RECORDING",
          timingMode: "PER_QUESTION",
          timePerItemSeconds: 180,
          prepTimeSeconds: 30,
          isScored: false, // se revisa en sesión en vivo
          subscoreMapping: [],
          adminFieldSchema: {
            version: 1,
            fields: [
              { key: "prompt", label: "Tema a hablar (1–3 minutos)", type: "textarea", target: "prompt", required: true },
            ],
          },
        },
      ],
    },
  ],
};
