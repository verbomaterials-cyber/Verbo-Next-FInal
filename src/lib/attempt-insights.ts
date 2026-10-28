import type { Prisma } from "@prisma/client";
import { closedPoints, delivered, deliveryMetadata, type RouteDecision } from "./toefl-delivery";
import { detAssessmentZ, detDelivered, detMetadata, detPoints } from "./det-format";
import { rubricAssessmentZ } from "./toefl-rubrics";

export type InsightQuestion = {
  id: string; order: number; promptContent: Prisma.JsonValue; correctAnswer: Prisma.JsonValue | null;
  questionType: { name: string; responseType: string; isScored: boolean; section: { skillsMeasured: string[] } };
};
export type InsightResponse = {
  questionId: string; answerContent: Prisma.JsonValue; isCorrect: boolean | null;
  reviewAssessment: Prisma.JsonValue | null; isFlagged: boolean;
};
export type AnswerState = "incorrect" | "partial" | "omitted" | "pending" | "correct" | "unscored";
export const answerStateLabels: Record<AnswerState, string> = {
  incorrect: "Incorrecta", partial: "Crédito parcial", omitted: "Sin responder", pending: "Por revisar", correct: "Correcta", unscored: "No puntúa",
};
export type SkillInsight = {
  name: string; earned: number; possible: number; pendingPoints: number; pending: number;
  correct: number; incorrect: number; partial: number; omitted: number; unscored: number; percent: number | null;
};

/** Uses the same delivery and partial-credit rules as grading. Never includes alternative branches. */
export function buildAttemptInsights(questions: InsightQuestion[], responses: InsightResponse[], runtime: unknown, overall: unknown) {
  const state = runtime as { routes?: Record<string, RouteDecision>; detSelections?: Record<string, string> } | null;
  const byQuestion = new Map(responses.map(r => [r.questionId, r]));
  const bySkill = new Map<string, SkillInsight>();
  const items = questions.filter(q => delivered(deliveryMetadata(q.promptContent), state?.routes ?? {}) &&
    detDelivered(detMetadata(q.promptContent), q.id, state?.detSelections ?? {})).map((question, index) => {
    const response = byQuestion.get(question.id);
    const toefl = deliveryMetadata(question.promptContent), det = detMetadata(question.promptContent);
    const skillNames = toefl ? [toefl.section] : det ? [det.skill] : question.questionType.section.skillsMeasured.map(s => s[0] + s.slice(1).toLowerCase());
    const answer = response?.answerContent as Record<string, unknown> | undefined;
    const open = ["FREE_TEXT", "AUDIO_RECORDING"].includes(question.questionType.responseType);
    const scored = question.questionType.isScored && toefl?.scored !== false;
    const assessment = (det ? detAssessmentZ : rubricAssessmentZ).safeParse(response?.reviewAssessment);
    let earned = 0, possible = scored ? 1 : 0;
    let status: AnswerState = !scored ? "unscored" : !response ? "omitted" : response.isCorrect === null ? "pending" : response.isCorrect ? "correct" : "incorrect";
    if (scored && open && (toefl || det)) {
      possible = 5;
      earned = assessment.success ? assessment.data.score : 0;
      const empty = question.questionType.responseType === "FREE_TEXT" ? !String(answer?.text ?? "").trim() : answer?.recorded !== true;
      status = empty ? "omitted" : !assessment.success ? "pending" : earned === possible ? "correct" : earned > 0 ? "partial" : "incorrect";
    } else if (scored && det) {
      const points = detPoints(question.promptContent as Record<string, unknown>, question.correctAnswer as Record<string, unknown> | null, answer ?? {});
      possible = points.possible;
      earned = det.task === "listen-complete" && assessment.success ? possible * assessment.data.score / 5 : points.earned;
      if (response && status !== "pending") status = earned === possible ? "correct" : earned > 0 ? "partial" : "incorrect";
    } else if (scored && toefl && !open && question.questionType.responseType !== "DRAG_SELECT") {
      ({ earned, possible } = closedPoints({ responseType: question.questionType.responseType, promptContent: question.promptContent as Record<string, unknown>, correctAnswer: question.correctAnswer as Record<string, unknown> | null }, answer));
      if (response) status = earned === possible ? "correct" : earned > 0 ? "partial" : "incorrect";
    } else if (scored) earned = response?.isCorrect === true ? 1 : 0;
    if (!possible) status = "unscored";
    for (const name of skillNames) {
      const skill = bySkill.get(name) ?? { name, earned: 0, possible: 0, pendingPoints: 0, pending: 0, correct: 0, incorrect: 0, partial: 0, omitted: 0, unscored: 0, percent: null };
      skill[status]++;
      skill.possible += possible;
      if (status === "pending") skill.pendingPoints += possible;
      else skill.earned += earned;
      bySkill.set(name, skill);
    }
    return { question, response, index: index + 1, status, earned, possible, skills: skillNames };
  });
  // A timed-out form can finish before the adaptive second module is selected.
  const raw = (overall as { raw?: Record<string, { earned: number; possible: number; pending: number }> } | null)?.raw;
  for (const skill of bySkill.values()) {
    const stored = raw?.[skill.name];
    if (stored && Number.isFinite(stored.earned) && Number.isFinite(stored.possible)) {
      skill.earned = stored.earned; skill.possible = stored.possible;
    }
    const evaluatedPossible = skill.possible - skill.pendingPoints;
    skill.percent = evaluatedPossible > 0 ? Math.round(100 * skill.earned / evaluatedPossible) : null;
  }
  const skills = [...bySkill.values()];
  const priorities = skills.filter(s => !s.pending && s.percent !== null && s.percent < 75).sort((a, b) => a.percent! - b.percent!).slice(0, 2).map(s => s.name);
  const counts = Object.fromEntries(Object.keys(answerStateLabels).map(key => [key, items.filter(i => i.status === key).length])) as Record<AnswerState, number>;
  return { items, skills, priorities, counts };
}
