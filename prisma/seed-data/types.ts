import type {
  SectionOrderMode,
  Skill,
  InputMedia,
  ResponseType,
  TimingMode,
} from "@prisma/client";

/*
 * Los contratos canónicos de adminFieldSchema y themeConfig viven en
 * src/lib/exam-config.ts (una sola fuente de verdad para seed y app).
 */
export type {
  AdminField,
  AdminFieldSchema,
  ThemeConfig,
} from "../../src/lib/exam-config";
import type { AdminFieldSchema, ThemeConfig } from "../../src/lib/exam-config";

/* ───────────── Forma del seed de un examen completo ───────────── */

export type QuestionTypeSeed = {
  name: string;
  inputMedia: InputMedia;
  responseType: ResponseType;
  timingMode: TimingMode;
  timePerItemSeconds?: number;
  prepTimeSeconds?: number;
  replaysAllowed?: number;
  isScored: boolean;
  subscoreMapping: string[];
  adminFieldSchema: AdminFieldSchema;
};

export type SectionSeed = {
  name: string;
  order?: number;
  durationMinutes: number;
  skillsMeasured: Skill[];
  questionTypes: QuestionTypeSeed[];
};

export type ExamSeed = {
  name: string;
  slug: string;
  description: string;
  totalDurationMinutes: number;
  sectionOrderMode: SectionOrderMode;
  hasAdaptiveLogic: boolean;
  subscoreDefinitions: string[];
  scoreScale: Record<string, unknown>;
  themeConfig: ThemeConfig;
  sections: SectionSeed[];
  versions: { label: string; hasFeedback: boolean; isPublished: boolean }[];
};
