import { z } from "zod";
import { PRACTICE_ROUTING_THRESHOLD, type DeliveryMetadata } from "./toefl-delivery";
import type { DetMeta } from "./det-format";

export type TimedQuestion = {
  id: string;
  sectionId: string;
  timingMode: "PER_QUESTION" | "PER_SECTION";
  timePerItemSeconds: number | null;
  prepTimeSeconds: number | null;
  sectionDurationMinutes: number;
  timingGroup?: { key: string; durationSeconds: number };
  requiresStimulus?: boolean;
  enforceSectionLimit?: boolean;
  delivery?: DeliveryMetadata;
  possiblePoints?: number;
  det?: DetMeta;
};

function timerGroup(question: TimedQuestion): string {
  return question.timingGroup ? `${question.sectionId}:${question.timingGroup.key}` : question.sectionId;
}

export const runtimeSchema = z.object({
  version: z.literal(1),
  questionIds: z.array(z.string()).min(1),
  index: z.number().int().nonnegative(),
  maxIndex: z.number().int().nonnegative(),
  examDeadlineAt: z.number().finite(),
  deadlineAt: z.number().finite(),
  totalSeconds: z.number().positive(),
  sectionDeadlines: z.record(z.string(), z.number().finite()),
  finished: z.boolean(),
  phase: z.enum(["stimulus", "prep", "answer"]).default("answer"),
  detSelections: z.record(z.string(), z.string()).default({}),
  audioPlays: z.record(z.string(), z.number().int().nonnegative()).default({}),
  routes: z.record(z.string(), z.object({ branch: z.enum(["lower", "upper"]), earned: z.number(), possible: z.number(), threshold: z.number() })).default({}),
  playedAudio: z.array(z.string()).default([]),
});

export type AttemptRuntime = z.infer<typeof runtimeSchema>;
export type RuntimeView = Pick<
  AttemptRuntime,
  "index" | "maxIndex" | "deadlineAt" | "totalSeconds" | "finished" | "phase"
> & { serverNow: number; questionId?: string; maxQuestionId?: string; routes?: AttemptRuntime["routes"]; playedAudio?: string[]; detSelections?: Record<string, string>; audioPlays?: Record<string, number> };

function enterQuestion(
  state: AttemptRuntime,
  questions: TimedQuestion[],
  index: number,
  now: number,
): AttemptRuntime {
  const question = questions[index];
  const phase = question.det?.prep ? "prep" : question.requiresStimulus ? "stimulus" : "answer";
  const totalSeconds = phase === "prep" ? question.det!.prep : phase === "stimulus" ? 120 : question.timingMode === "PER_QUESTION"
    ? (question.timePerItemSeconds ?? 60) + (question.prepTimeSeconds ?? 0)
    : question.timingGroup?.durationSeconds ?? question.sectionDurationMinutes * 60;
  const sectionDeadlines = { ...state.sectionDeadlines };
  const sectionCapKey = `section-limit:${question.sectionId}`;
  if (question.enforceSectionLimit && sectionDeadlines[sectionCapKey] === undefined) {
    sectionDeadlines[sectionCapKey] = now + question.sectionDurationMinutes * 60_000;
  }
  let deadlineAt = now + totalSeconds * 1000;
  if (question.timingMode === "PER_SECTION") {
    const group = timerGroup(question);
    deadlineAt = sectionDeadlines[group] ?? deadlineAt;
    sectionDeadlines[group] = deadlineAt;
  }
  return {
    ...state,
    index,
    maxIndex: Math.max(state.maxIndex, index),
    deadlineAt: Math.min(deadlineAt, state.examDeadlineAt,
      question.enforceSectionLimit ? sectionDeadlines[sectionCapKey] : Infinity),
    totalSeconds,
    sectionDeadlines,
    phase,
  };
}

export function createRuntime(
  questions: TimedQuestion[],
  startedAt: number,
  examDurationMinutes: number,
): AttemptRuntime {
  if (questions.length === 0) throw new Error("El examen no tiene preguntas.");
  const initial: AttemptRuntime = {
    version: 1,
    questionIds: questions.map((q) => q.id),
    index: 0,
    maxIndex: 0,
    examDeadlineAt: startedAt + examDurationMinutes * 60_000,
    deadlineAt: startedAt,
    totalSeconds: 1,
    sectionDeadlines: {},
    finished: false,
    phase: "answer",
    routes: {},
    playedAudio: [],
    detSelections: {}, audioPlays: {},
  };
  const first = selectDetQuestion(initial, questions, 0, {});
  return enterQuestion(first.state, questions, first.index, startedAt);
}

function selectDetQuestion(state: AttemptRuntime, questions: TimedQuestion[], index: number, earned: Record<string, number>) {
  const meta = questions[index]?.det;
  if (!meta?.slot) return { state, index };
  const candidates = questions.map((q, i) => ({ q, i })).filter(({ q }) => q.det?.slot === meta.slot);
  const prior = questions.slice(0, index).filter((q) => q.det?.slot && state.detSelections[q.det.slot] === q.id).slice(-6);
  const possible = prior.reduce((sum, q) => sum + (q.possiblePoints ?? 1), 0);
  const ratio = possible ? prior.reduce((sum, q) => sum + (earned[q.id] ?? 0), 0) / possible : .6;
  const level = ratio >= .8 ? 5 : ratio < .4 ? 1 : 3;
  const selected = candidates.find(({ q }) => q.id === state.detSelections[meta.slot!]) ?? candidates.find(({ q }) => q.det?.level === level) ?? candidates[0];
  return { state: { ...state, detSelections: { ...state.detSelections, [meta.slot]: selected.q.id } }, index: selected.i };
}

export function readRuntime(
  value: unknown,
  questions: TimedQuestion[],
): AttemptRuntime | null {
  if (value === null || value === undefined) return null;
  const state = runtimeSchema.parse(value);
  if (
    state.index >= questions.length || state.maxIndex >= questions.length ||
    state.questionIds.length !== questions.length ||
    state.questionIds.some((id, index) => questions[index].id !== id)
  ) {
    throw new Error("La estructura de este examen cambió. Contacta a tu asesor.");
  }
  return state;
}

export function runtimeView(state: AttemptRuntime, now = Date.now()): RuntimeView {
  return {
    index: state.index,
    maxIndex: state.maxIndex,
    deadlineAt: state.deadlineAt,
    totalSeconds: state.totalSeconds,
    finished: state.finished,
    phase: state.phase,
    serverNow: now,
    questionId: state.questionIds[state.index],
    maxQuestionId: state.questionIds[state.maxIndex],
    routes: state.routes,
    playedAudio: state.playedAudio,
    detSelections: state.detSelections, audioPlays: state.audioPlays,
  };
}

export function remainingSeconds(deadlineAt: number, now: number): number {
  return Math.max(0, Math.ceil((deadlineAt - now) / 1000));
}

export function advanceRuntime(
  state: AttemptRuntime,
  questions: TimedQuestion[],
  now: number,
  earnedByQuestion: Record<string, number> = {},
): AttemptRuntime {
  if (state.finished) return state;
  let next = state.index + 1;
  const question = questions[state.index];
  if (question.det?.slot) while (next < questions.length && questions[next].det?.slot === question.det.slot) next++;
  const sectionExpired = question.enforceSectionLimit &&
    now >= state.sectionDeadlines[`section-limit:${question.sectionId}`];
  if (now >= state.examDeadlineAt) next = questions.length;
  else if (sectionExpired) {
    while (next < questions.length && questions[next].sectionId === question.sectionId) next++;
  }
  else if (now >= state.deadlineAt && question.timingMode === "PER_SECTION") {
    // Expiration closes the entire section, including unanswered questions.
    while (next < questions.length && timerGroup(questions[next]) === timerGroup(question)) next++;
  }
  const meta = question.delivery;
  if (meta?.module === "router" && !state.routes[meta.section] &&
    (now >= state.deadlineAt || questions[next]?.delivery?.module !== "router" || questions[next]?.sectionId !== question.sectionId)) {
    const router = questions.filter((q) => q.sectionId === question.sectionId && q.delivery?.module === "router");
    const possible = router.reduce((total, q) => total + (q.possiblePoints ?? 1), 0);
    const earned = router.reduce((total, q) => total + Math.min(q.possiblePoints ?? 1, Math.max(0, earnedByQuestion[q.id] ?? 0)), 0);
    state = { ...state, routes: { ...state.routes, [meta.section]: {
      branch: possible > 0 && earned / possible >= PRACTICE_ROUTING_THRESHOLD ? "upper" : "lower", earned, possible, threshold: PRACTICE_ROUTING_THRESHOLD,
    } } };
  }
  while (next < questions.length) {
    const delivery = questions[next].delivery;
    if (!delivery || delivery.module === "linear" || delivery.module === "router" || state.routes[delivery.section]?.branch === delivery.module) break;
    next++;
  }
  if (next >= questions.length) return { ...state, finished: true };
  const selected = selectDetQuestion(state, questions, next, earnedByQuestion);
  return enterQuestion(selected.state, questions, selected.index, now);
}

export function jumpRuntime(state: AttemptRuntime, questions: TimedQuestion[], questionId: string, now: number): AttemptRuntime {
  const index = questions.findIndex((q) => q.id === questionId);
  const current = questions[state.index];
  if (index < 0 || index > state.maxIndex || state.finished || now >= state.deadlineAt ||
    current.timingMode !== "PER_SECTION" || timerGroup(questions[index]) !== timerGroup(current)) {
    throw new Error("Solo puedes revisar preguntas visitadas del módulo activo.");
  }
  return enterQuestion(state, questions, index, now);
}

export function beginSpokenResponse(state: AttemptRuntime, questions: TimedQuestion[], now: number): AttemptRuntime {
  if (state.finished || state.phase === "answer") return state;
  if (state.phase !== "prep" && now >= state.deadlineAt) throw new Error("El tiempo para escuchar la consigna terminó.");
  const question = questions[state.index];
  const seconds = question.det?.seconds ?? (question.timePerItemSeconds ?? 45) + (question.prepTimeSeconds ?? 0);
  const start = state.phase === "prep" ? Math.min(now, state.deadlineAt) : now;
  return {
    ...state, phase: "answer", totalSeconds: seconds,
    deadlineAt: Math.min(start + seconds * 1000, state.examDeadlineAt,
      state.sectionDeadlines[`section-limit:${question.sectionId}`] ?? Infinity),
  };
}

export function previousRuntime(
  state: AttemptRuntime,
  questions: TimedQuestion[],
  allowBack: boolean,
  now: number,
): AttemptRuntime {
  const current = questions[state.index];
  const previous = questions[state.index - 1];
  if (
    !allowBack || state.finished || !previous || now >= state.deadlineAt ||
    current.timingMode !== "PER_SECTION" || timerGroup(previous) !== timerGroup(current)
  ) throw new Error("No puedes volver a esa pregunta.");
  return enterQuestion(state, questions, state.index - 1, now);
}
