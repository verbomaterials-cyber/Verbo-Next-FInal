import { z } from "zod";
export const RUBRIC_VERSION = "verbo-toefl-2026-holistic-v1";
export const rubricAssessmentZ = z.object({ version: z.literal(RUBRIC_VERSION), task: z.string(), score: z.number().int().min(0).max(5), source: z.enum(["teacher", "missing"]) });
export const toeflRubrics: Record<string, { criteria: string[]; levels: string[] }> = {
  "Write an Email": {
    criteria: ["Cumplimiento de los puntos y propósito comunicativo", "Organización, cohesión y adecuación al destinatario", "Precisión y variedad de gramática y vocabulario"],
    levels: ["Sin respuesta evaluable, ajena al encargo o copiada íntegramente.", "Contenido mínimo; el mensaje resulta difícil de interpretar.", "Cumplimiento limitado; faltan puntos importantes y los errores dificultan entender.", "Propósito reconocible y desarrollo suficiente, con omisiones o errores perceptibles.", "Mensaje claro, pertinente y organizado; pequeños errores no impiden la comunicación.", "Cumple y desarrolla el encargo con claridad, tono adecuado y buen dominio del lenguaje."],
  },
  "Write for an Academic Discussion": {
    criteria: ["Postura pertinente y contribución propia a la discusión", "Desarrollo con razones o ejemplos y organización", "Variedad y precisión del lenguaje"],
    levels: ["Sin contribución evaluable, fuera de tema o enteramente copiada.", "Ideas mínimas o lenguaje que impide entender la postura.", "Contribución poco desarrollada; errores frecuentes dificultan la comunicación.", "Postura comprensible con apoyo limitado y control lingüístico desigual.", "Contribución pertinente y desarrollada; lenguaje claro con errores menores.", "Contribución bien elaborada y coherente, con apoyo relevante y lenguaje preciso y variado."],
  },
  "Listen and Repeat": {
    criteria: ["Integridad y exactitud respecto del estímulo", "Preservación del significado, palabras y terminaciones", "Inteligibilidad; no penalizar el acento por sí mismo"],
    levels: ["Sin respuesta, ininteligible o sin relación con el estímulo.", "Solo fragmentos aislados reconocibles de la oración.", "Repetición parcial con omisiones importantes; se recupera parte del contenido.", "Oración sustancialmente completa, pero cambios u omisiones alteran el significado.", "Preserva el significado con cambios menores o alguna imprecisión de pronunciación.", "Repetición completa, exacta y plenamente inteligible."],
  },
  "Take an Interview": {
    criteria: ["Respuesta directa y desarrollo de ideas", "Coherencia y fluidez", "Variedad y precisión de gramática y vocabulario", "Inteligibilidad y prosodia"],
    levels: ["Sin respuesta evaluable, ininteligible o ajena a la pregunta.", "Producción mínima sin una respuesta conectada comprensible.", "Respuesta limitada; pausas, errores o pronunciación dificultan entender.", "Respuesta pertinente y comprensible con desarrollo o control lingüístico desigual.", "Respuesta clara y suficientemente desarrollada; buena fluidez e inteligibilidad.", "Respuesta bien desarrollada y coherente, fluida e inteligible, con lenguaje preciso y variado."],
  },
};
