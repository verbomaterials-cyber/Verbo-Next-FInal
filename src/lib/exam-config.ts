import { z } from "zod";
import { validSentenceOrder } from "./sentence-answer";

/*
 * Contratos canónicos de configuración por examen.
 * - AdminFieldSchema: define el formulario dinámico de captura de preguntas.
 * - ThemeConfig: define la identidad visual/conductual del motor de examen.
 * El seed (prisma/seed-data) y toda la app validan contra este módulo.
 */

export const FIELD_TYPES = [
  "text",
  "textarea",
  "number",
  "toggle",
  "audio",
  "image",
  "video",
  "options",
  "list",
  "repeater",
] as const;

export type FieldType = (typeof FIELD_TYPES)[number];

export type AdminField = {
  key: string;
  label: string;
  type: FieldType;
  target: "prompt" | "answer";
  required?: boolean;
  help?: string;
  multiple?: boolean;
  withCorrect?: boolean;
  /** true = solo visible para el admin; el motor de examen no lo muestra al alumno */
  studentHidden?: boolean;
  itemFields?: AdminField[];
};

const adminFieldBase = z.object({
  key: z
    .string()
    .min(1)
    .regex(/^[a-zA-Z][a-zA-Z0-9_]*$/, "key debe ser identificador (letras/números/_)"),
  label: z.string().min(1),
  type: z.enum(FIELD_TYPES),
  target: z.enum(["prompt", "answer"]),
  required: z.boolean().optional(),
  help: z.string().optional(),
  multiple: z.boolean().optional(),
  withCorrect: z.boolean().optional(),
  studentHidden: z.boolean().optional(),
});

export const adminFieldZ: z.ZodType<AdminField> = adminFieldBase.extend({
  itemFields: z.lazy(() => z.array(adminFieldZ)).optional(),
}) as z.ZodType<AdminField>;

export const adminFieldSchemaZ = z.object({
  version: z.literal(1),
  fields: z.array(adminFieldZ).min(1, "Define al menos un campo"),
  timingGroup: z.object({
    key: z.string().regex(/^[a-z0-9-]+$/),
    durationSeconds: z.number().int().positive(),
  }).optional(),
});

export type AdminFieldSchema = z.infer<typeof adminFieldSchemaZ>;

export const themeConfigZ = z.object({
  examInterface: z.enum(["generic", "toefl"]).optional(),
  formatVersion: z.string().optional(),
  officialSources: z.array(z.string().url()).optional(),
  palette: z.object({
    bg: z.string(),
    surface: z.string(),
    ink: z.string(),
    inkMuted: z.string(),
    accent: z.string(),
    accentStrong: z.string(),
    line: z.string(),
    warning: z.string(),
  }),
  timer: z.object({
    style: z.enum(["bar", "clock"]),
    position: z.enum(["top-bar", "corner"]),
    warnUnderSeconds: z.number().int().nonnegative(),
  }),
  layout: z.object({
    questionMaxWidth: z.number().int().positive(),
    split: z.boolean(),
    splitRatio: z.tuple([z.number(), z.number()]).optional(),
  }),
  progress: z.object({ mode: z.enum(["ambiguous", "counter"]) }),
  navigation: z.object({ allowBack: z.boolean() }),
  showStepper: z.boolean(),
  disclaimer: z.string(),

  // Tipografía por examen. Los valores son referencias CSS a variables de
  // fuente (next/font); el motor las inyecta como --xfont-*. Pareadas en eje
  // de contraste (display vs texto), nunca dos sans idénticas.
  typography: z
    .object({
      display: z.string(), // números, timer, títulos de tipo de pregunta
      body: z.string(), // enunciados, opciones, cuerpo
      serifTitles: z.boolean(), // los títulos de sección/pregunta usan la display serif
    })
    .default({
      display: "var(--font-geist-sans)",
      body: "var(--font-geist-sans)",
      serifTitles: false,
    }),

  // Firma visual: geometría y ritmo que distinguen cada examen sin tocar lógica.
  style: z
    .object({
      radius: z.number(), // radio de la tarjeta de pregunta (px)
      controlRadius: z.number(), // radio de botones y opciones (px)
      transition: z.enum(["fade", "instant"]), // paso entre preguntas
      stepperStyle: z.enum(["hairline", "dots"]), // solo si showStepper
    })
    .default({
      radius: 16,
      controlRadius: 12,
      transition: "fade",
      stepperStyle: "dots",
    }),
});

export type ThemeConfig = z.infer<typeof themeConfigZ>;

/** Plantilla neutral para exámenes nuevos; el admin la ajusta después. */
export function defaultThemeConfig(accent = "#4A5568"): ThemeConfig {
  return {
    palette: {
      bg: "#FAFAFA",
      surface: "#FFFFFF",
      ink: "#1F2937",
      inkMuted: "#57636F",
      accent,
      accentStrong: accent,
      line: "#E5E7EB",
      warning: "#C2410C",
    },
    timer: { style: "clock", position: "corner", warnUnderSeconds: 60 },
    layout: { questionMaxWidth: 760, split: false },
    progress: { mode: "counter" },
    navigation: { allowBack: false },
    showStepper: false,
    typography: {
      display: "var(--font-geist-sans)",
      body: "var(--font-geist-sans)",
      serifTitles: false,
    },
    style: { radius: 16, controlRadius: 12, transition: "fade", stepperStyle: "dots" },
    disclaimer:
      "Simulación de práctica — no afiliado a ningún organismo certificador.",
  };
}

/** Plantilla de arranque que se muestra al crear un tipo de pregunta. */
export const ADMIN_FIELD_SCHEMA_TEMPLATE: AdminFieldSchema = {
  version: 1,
  fields: [
    {
      key: "question",
      label: "Pregunta",
      type: "textarea",
      target: "prompt",
      required: true,
    },
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
};

/**
 * Valida el contenido de una pregunta contra el adminFieldSchema de su tipo:
 * los campos requeridos deben existir en el target correspondiente.
 * Los campos "options" con withCorrect exigen además índices correctos
 * en correctAnswer bajo la misma key.
 */
export function validateQuestionPayload(
  schema: AdminFieldSchema,
  prompt: Record<string, unknown>,
  answer: Record<string, unknown> | null,
): string[] {
  const errors: string[] = [];
  if (schema.fields.some((field) => field.key === "wordBank" && field.target === "prompt")) {
    const bank = prompt.wordBank;
    const slots = prompt.slots;
    if (!Array.isArray(bank) || bank.length < 1 || bank.length > 30 || bank.some((word) => typeof word !== "string" || !word.trim())) {
      errors.push("wordBank debe contener entre 1 y 30 grupos de palabras.");
    }
    if (typeof slots !== "number" || !Number.isInteger(slots) || slots < 1 || slots > 30) {
      errors.push("slots debe ser un entero entre 1 y 30.");
    }
    if (!Array.isArray(answer?.order) || !validSentenceOrder(answer.order.map(Number), bank, slots)) {
      errors.push("order debe indicar los índices correctos, sin repeticiones, para todos los espacios.");
    }
    if (answer?.acceptedOrders !== undefined && (!Array.isArray(answer.acceptedOrders) ||
      answer.acceptedOrders.some((order) => !Array.isArray(order) || !validSentenceOrder(order.map(Number), bank, slots)))) {
      errors.push("acceptedOrders debe contener únicamente órdenes alternativos completos, válidos y sin repeticiones.");
    }
  }
  for (const field of schema.fields) {
    const source = field.target === "prompt" ? prompt : (answer ?? {});
    const value = source[field.key];
    const empty =
      value === undefined ||
      value === null ||
      (typeof value === "string" && value.trim() === "") ||
      (Array.isArray(value) && value.length === 0);
    if (field.required && empty) {
      errors.push(`Falta el campo requerido "${field.key}" (${field.label}).`);
    }
    if (field.type === "options" && field.withCorrect && !empty) {
      const correct = (answer ?? {})[field.key];
      if (
        correct === undefined ||
        (Array.isArray(correct) && correct.length === 0)
      ) {
        errors.push(
          `El campo "${field.key}" requiere respuesta correcta en correctAnswer.${field.key}.`,
        );
      }
    }
  }
  return errors;
}
