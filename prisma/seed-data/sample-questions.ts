import toeflDiagnostic from "../../content/toefl-2026/diagnostic.json";

export function toeflSampleQuestions(): SampleQuestion[] {
  return toeflDiagnostic.questions as SampleQuestion[];
}

/*
 * Preguntas de ejemplo (NO contenido real de ningún examen) para poder
 * probar el motor de examen. Se insertan en la versión "Diagnóstico" de
 * cada examen solo si el tipo correspondiente aún no tiene preguntas ahí.
 *
 * Los audios usan un WAV generado (tono suave) como data URI para que el
 * reproductor funcione sin depender de archivos externos.
 */

/** WAV PCM 8-bit 8kHz de `seconds` con un tono suave — reproducible en cualquier navegador. */
export function toneWavDataUri(seconds = 2, freq = 440): string {
  const sampleRate = 8000;
  const numSamples = Math.floor(sampleRate * seconds);
  const dataSize = numSamples;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(1, 22); // mono
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate, 28);
  buffer.writeUInt16LE(1, 32);
  buffer.writeUInt16LE(8, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);
  for (let i = 0; i < numSamples; i++) {
    const fade = Math.min(1, i / 400, (numSamples - i) / 400);
    const sample = Math.sin((2 * Math.PI * freq * i) / sampleRate) * 40 * fade;
    buffer.writeUInt8(Math.round(128 + sample), 44 + i);
  }
  return `data:audio/wav;base64,${buffer.toString("base64")}`;
}

export type SampleQuestion = {
  questionType: string;
  prompt: Record<string, unknown>;
  answer: Record<string, unknown> | null;
  feedback?: string;
  difficulty?: number;
};

export function detSampleQuestions(): SampleQuestion[] {
  const audio = toneWavDataUri(2, 440);
  return [
    {
      questionType: "Read and Select",
      prompt: { words: ["garden", "plimsole", "bright", "vanterous", "quickly"] },
      answer: { words: [0, 2, 4] },
      feedback:
        "“garden”, “bright” y “quickly” son palabras reales; “plimsole” y “vanterous” son pseudo-palabras.",
      difficulty: 2,
    },
    {
      questionType: "Read and Complete",
      prompt: { text: "The sun r[ises] in the e[ast] and sets in the w[est]." },
      answer: { answers: ["ises", "ast", "est"] },
      feedback: "Frase de geografía básica: rises / east / west.",
      difficulty: 1,
    },
    {
      questionType: "Complete the Words",
      prompt: { text: "She enjoys rea[ding] books about anc[ient] history." },
      answer: { answers: ["ding", "ient"] },
      feedback: "reading / ancient.",
      difficulty: 2,
    },
    {
      questionType: "Listen and Type",
      prompt: { audioUrl: audio },
      answer: { transcript: "The weather is nice today." },
      feedback: "Se compara tu transcripción con la oración original.",
      difficulty: 2,
    },
    {
      questionType: "Write About the Photo",
      prompt: { imageUrl: "https://picsum.photos/seed/verbo-photo/800/540" },
      answer: null,
      feedback: "Describe lo que ves: sujeto, acción y contexto en 1–2 oraciones.",
      difficulty: 3,
    },
    {
      questionType: "Read, Then Speak",
      prompt: {
        prompt:
          "Describe a place you like to visit. Explain what it looks like and why you enjoy going there.",
      },
      answer: null,
      feedback: "Se evalúa fluidez, vocabulario y organización de ideas.",
      difficulty: 3,
    },
    {
      questionType: "Writing Sample",
      prompt: {
        prompt:
          "Some people prefer to live in a big city, others in a small town. Which do you prefer and why?",
      },
      answer: null,
    },
  ];
}

export function legacyToeflSampleQuestions(): SampleQuestion[] {
  const audio = toneWavDataUri(3, 330);
  return [
    {
      questionType: "Reading Comprehension",
      prompt: {
        passage:
          "Urban gardens have become increasingly common in large cities. Beyond producing food, they strengthen neighborhood ties: residents who garden together report knowing more of their neighbors by name and feeling safer on their streets. City planners now treat community gardens as social infrastructure, comparable to libraries or parks, rather than as temporary uses of vacant land.",
        question: "According to the passage, why do city planners value community gardens?",
        options: [
          "They increase property values",
          "They function as social infrastructure",
          "They replace public libraries",
          "They reduce the need for parks",
        ],
      },
      answer: { options: 1 },
      feedback:
        "El pasaje dice que los planificadores las tratan como “social infrastructure”, comparable a bibliotecas o parques.",
      difficulty: 3,
    },
    {
      questionType: "Listening Comprehension",
      prompt: {
        audioUrl: audio,
        context: "Listen to part of a lecture in a biology class.",
        question: "What is the main topic of the lecture?",
        options: [
          "Migration patterns of birds",
          "Photosynthesis in desert plants",
          "The structure of cells",
          "Ocean current formation",
        ],
      },
      answer: { options: 0 },
      feedback: "La conferencia trata sobre patrones de migración.",
      difficulty: 3,
    },
    {
      questionType: "Interview Speaking",
      prompt: {
        audioUrl: toneWavDataUri(2, 500),
        topicLabel: "Hometown",
      },
      answer: null,
      feedback: "Formato 2026: escuchas la pregunta y respondes de inmediato durante 45 segundos.",
      difficulty: 2,
    },
    {
      questionType: "Academic Discussion",
      prompt: {
        professorPost:
          "This week we discussed remote work. Some argue it improves productivity; others say it weakens collaboration. What do you think companies should prioritize?",
        studentReplies: [
          {
            author: "Claire",
            text: "I believe flexibility matters most. People do their best work when they control their schedule.",
          },
          {
            author: "Andrew",
            text: "I disagree. Teams need face-to-face time to build trust; collaboration should come first.",
          },
        ],
        minWords: 100,
      },
      answer: null,
      feedback: "Se evalúa postura clara, desarrollo y conexión con las ideas de los compañeros.",
      difficulty: 4,
    },
  ];
}
