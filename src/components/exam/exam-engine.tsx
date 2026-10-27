"use client";

/*
 * Motor compartido de avance, guardado y tiempos. La configuración define
 * las reglas de cada examen; TOEFL utiliza su interfaz y flujo específicos.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ThemeConfig } from "@/lib/exam-config";
import { beginSpeaking, completeAttempt, markAudioPlayed, navigateAttempt, reviewAttemptQuestion, saveResponse } from "@/lib/student/actions";
import { ToeflExamLayout } from "./toefl-exam-layout";
import { remainingSeconds, type RuntimeView } from "@/lib/attempt-runtime";
import { ExamTimer } from "./exam-timer";
import { QuestionFlag } from "./question-flag";
import { QuestionNavButton } from "./question-nav-button";
import { SectionProgressStepper } from "./section-stepper";
import {
  QuestionRenderer,
  isAnswerValid,
  type AnswerValue,
  type EngineQuestion,
} from "./question-renderer";

export type EngineSection = {
  id: string;
  name: string;
  durationMinutes: number;
};

/** Color de texto legible sobre el acento (menta → tinta; marino → blanco). */
function onAccent(hex: string): string {
  const c = hex.replace("#", "");
  if (c.length < 6) return "#FFFFFF";
  const toLin = (v: number) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  const r = toLin(parseInt(c.slice(0, 2), 16) / 255);
  const g = toLin(parseInt(c.slice(2, 4), 16) / 255);
  const b = toLin(parseInt(c.slice(4, 6), 16) / 255);
  const L = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return L > 0.45 ? "#18181B" : "#FFFFFF";
}

export function ExamEngine({
  attemptId,
  examName,
  examSlug,
  theme,
  fontClass,
  sections,
  questions,
  initialAnswers,
  initialFlags,
  initialRuntime,
  fullLength = false,
}: {
  attemptId: string;
  examName: string;
  examSlug?: string;
  theme: ThemeConfig;
  /** classNames de las variables de fuente (next/font) para el subárbol del motor */
  fontClass: string;
  /** ordenadas; para MIXED es una sola lista lógica */
  sections: EngineSection[];
  questions: EngineQuestion[];
  initialAnswers: Record<string, AnswerValue>;
  initialFlags: Record<string, boolean>;
  initialRuntime: RuntimeView;
  fullLength?: boolean;
}) {
  const router = useRouter();

  const [runtime, setRuntime] = useState(initialRuntime);
  const index = runtime.questionId ? Math.max(0, questions.findIndex((q) => q.id === runtime.questionId)) : runtime.index;
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>(initialAnswers);
  const [flags, setFlags] = useState<Record<string, boolean>>(initialFlags);
  const [submitting, setSubmitting] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savingDraft, setSavingDraft] = useState(false);
  const [mediaBusy, setMediaBusy] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [endModuleOpen, setEndModuleOpen] = useState(false);
  const reviewDialogRef = useRef<HTMLElement>(null);
  const navigationRef = useRef(false);
  const offsetRef = useRef(0);
  const expiredRef = useRef<string | null>(null);
  const [now, setNow] = useState(initialRuntime.serverNow);

  useEffect(() => {
    if (!reviewOpen && !endModuleOpen) return;
    const previousFocus = document.activeElement;
    const controls = () => Array.from(reviewDialogRef.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? []);
    const timeout = setTimeout(() => controls()[0]?.focus(), 0);
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); setReviewOpen(false); setEndModuleOpen(false); }
      if (event.key !== "Tab") return;
      const elements = controls();
      const first = elements[0], last = elements.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener("keydown", handleKey);
    return () => { clearTimeout(timeout); document.removeEventListener("keydown", handleKey); if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus(); };
  }, [reviewOpen, endModuleOpen]);

  const question = questions[index];
  const qt = question.questionType;
  const answer = answers[question.id] ?? EMPTY_ANSWER;
  const flagged = flags[question.id] ?? false;

  /* ── tiempos ── */
  useEffect(() => {
    offsetRef.current = initialRuntime.serverNow - Date.now();
    const tick = setInterval(() => setNow(Date.now() + offsetRef.current), 250);
    return () => clearInterval(tick);
  }, [initialRuntime.serverNow]);

  /* ── navegación ── */
  const sectionIndex = sections.findIndex((s) => s.id === qt.sectionId);
  const sectionQuestions = questions.filter((q) => q.questionType.sectionId === qt.sectionId);
  const indexInSection = sectionQuestions.findIndex((q) => q.id === question.id);
  const isLast = index === questions.length - 1;
  const toefl = theme.examInterface === "toefl" || examSlug === "toefl-ibt";
  const moduleQuestions = question.module ? sectionQuestions.filter((q) => q.module?.id === question.module?.id) : sectionQuestions;
  const modulePosition = moduleQuestions.findIndex((q) => q.id === question.id);
  const moduleNumber = question.module?.number;
  const moduleBoundary = fullLength && (!questions[index + 1] || questions[index + 1].questionType.sectionId !== qt.sectionId ||
    question.module && questions[index + 1]?.module?.id !== question.module.id);
  const audioUrl = typeof question.promptContent.audioUrl === "string" ? question.promptContent.audioUrl : undefined;
  const audioConsumed = !!audioUrl && (runtime.playedAudio ?? []).includes(audioUrl);
  const onAudioStarted = useCallback(async () => {
    if (!fullLength) return;
    const result = await markAudioPlayed({ attemptId, questionId: question.id });
    if (!result.ok) { setSaveError(result.error); throw new Error(result.error); }
    if (audioUrl) setRuntime((previous) => ({ ...previous, playedAudio: [...new Set([...(previous.playedAudio ?? []), audioUrl])] }));
  }, [fullLength, attemptId, question.id, audioUrl]);

  const onStimulusEnded = useCallback(async () => {
    try {
      const result = await beginSpeaking({ attemptId, questionId: question.id });
      if (!result.ok || !result.data) { setSaveError(result.ok ? "No se pudo iniciar la respuesta." : result.error); return; }
      offsetRef.current = result.data.serverNow - Date.now();
      setNow(result.data.serverNow);
      setRuntime(result.data);
      setSaveError(null);
    } catch { setSaveError("No se pudo iniciar la grabación. Revisa tu conexión."); }
  }, [attemptId, question.id]);

  const persist = useCallback(
    async (qid: string, value: AnswerValue, flagged: boolean) => {
      try {
        const result = await saveResponse({ attemptId, questionId: qid, answerContent: value, isFlagged: flagged });
        if (!result.ok) setSaveError(result.error);
        else setSaveError(null);
        return result.ok;
      } catch {
        setSaveError("Se perdió la conexión. Tu respuesta sigue en esta pantalla; reintenta.");
        return false;
      }
    },
    [attemptId],
  );

  const navigate = useCallback(async (direction: "next" | "previous") => {
    if (navigationRef.current || mediaBusy) return;
    navigationRef.current = true;
    setSubmitting(true);
    try {
      const result = runtime.finished
        ? { ok: true as const, data: runtime }
        : await navigateAttempt({ attemptId, questionId: question.id, answerContent: answer, isFlagged: flagged, direction });
      if (!result.ok || !result.data) {
        setSaveError(result.ok ? "No se recibió el avance del examen." : result.error);
        return;
      }
      const next = result.data;
      if (JSON.stringify(next.routes ?? {}) !== JSON.stringify(runtime.routes ?? {})) {
        setReviewOpen(false); setEndModuleOpen(false);
        router.refresh();
        return;
      }
      offsetRef.current = next.serverNow - Date.now();
      setNow(next.serverNow);
      setRuntime(next);
      setSaveError(null);
      setReviewOpen(false); setEndModuleOpen(false);
      if (next.finished) {
        const completed = await completeAttempt({ attemptId });
        if (!completed.ok) { setSaveError(completed.error); return; }
        router.push(`/alumno/resultado/${attemptId}`);
      }
    } catch {
      setSaveError("No se pudo conectar con el servidor. Reintenta sin cerrar esta pantalla.");
    } finally {
      navigationRef.current = false;
      setSubmitting(false);
    }
  }, [attemptId, question.id, answer, flagged, runtime, router, mediaBusy]);

  async function jumpTo(targetQuestionId: string) {
    if (navigationRef.current || mediaBusy) return;
    navigationRef.current = true; setSubmitting(true);
    try {
      const result = await reviewAttemptQuestion({ attemptId, questionId: question.id, targetQuestionId, answerContent: answer, isFlagged: flagged });
      if (!result.ok || !result.data) { setSaveError(result.ok ? "No se recibió la pregunta." : result.error); return; }
      setRuntime(result.data); setReviewOpen(false); setSaveError(null);
    } catch { setSaveError("No se pudo abrir la pregunta. Reintenta."); }
    finally { navigationRef.current = false; setSubmitting(false); }
  }

  const timerRemaining = remainingSeconds(runtime.deadlineAt, now);
  const expired = timerRemaining === 0;

  useEffect(() => {
    const key = `${question.id}:${runtime.deadlineAt}:${runtime.finished}`;
    if (mediaBusy || (!expired && !runtime.finished) || expiredRef.current === key) return;
    const timeout = setTimeout(() => {
      expiredRef.current = key;
      void navigate("next");
    }, 0);
    return () => clearTimeout(timeout);
  }, [expired, question.id, runtime.deadlineAt, runtime.finished, navigate, mediaBusy]);

  useEffect(() => {
    if (submitting || runtime.finished || expired || (answer === EMPTY_ANSWER && !flagged)) return;
    const timeout = setTimeout(async () => {
      setSavingDraft(true);
      try { await persist(question.id, answer, flagged); }
      finally { setSavingDraft(false); }
    }, 800);
    return () => clearTimeout(timeout);
  }, [answer, flagged, question.id, persist, submitting, expired, runtime.finished]);

  /* ── tema → CSS vars ── */
  const serif = theme.typography.serifTitles;
  const cssVars = useMemo(
    () =>
      ({
        "--xbg": theme.palette.bg,
        "--xsurface": theme.palette.surface,
        "--xink": theme.palette.ink,
        "--xmuted": theme.palette.inkMuted,
        "--xaccent": theme.palette.accent,
        "--xaccent2": theme.palette.accentStrong,
        "--xline": theme.palette.line,
        "--xwarn": theme.palette.warning,
        "--xon-accent": onAccent(theme.palette.accent),
        "--xfont-display": theme.typography.display,
        "--xfont-body": theme.typography.body,
        "--xbtn-font": serif ? theme.typography.body : theme.typography.display,
        "--xbtn-tracking": serif ? "0.02em" : "0",
        "--xradius": `${theme.style.radius}px`,
        "--xcontrol": `${theme.style.controlRadius}px`,
      }) as React.CSSProperties,
    [theme, serif],
  );

  const timerTotal = runtime.totalSeconds;

  const valid = isAnswerValid(question, answer);
  const previousType = questions[index - 1]?.questionType;
  const canBack = theme.navigation.allowBack && qt.timingMode === "PER_SECTION" && indexInSection > 0 && !expired &&
    previousType?.timingGroupKey === qt.timingGroupKey && (!toefl || sections[sectionIndex]?.name === "Reading");
  const contentMax = theme.layout.split ? 1120 : theme.layout.questionMaxWidth;

  if (toefl) {
    const itemStart = moduleQuestions.slice(0, modulePosition).reduce((total, q) => total + (q.itemCount ?? 1), 0) + 1;
    const itemEnd = itemStart + (question.itemCount ?? 1) - 1;
    return <><ToeflExamLayout sections={sections.map((section) => section.name)} activeSection={sectionIndex}
      moduleNumber={moduleNumber}
      questionName={qt.name} questionNumber={fullLength ? itemEnd > itemStart ? `${itemStart}–${itemEnd}` : itemStart : indexInSection + 1}
      questionCount={fullLength ? moduleQuestions.reduce((total, q) => total + (q.itemCount ?? 1), 0) : sectionQuestions.length}
      seconds={timerRemaining} phase={runtime.phase === "prep" ? "answer" : runtime.phase} flagged={flagged}
      onFlag={() => setFlags((previous) => ({ ...previous, [question.id]: !flagged }))}
      onNext={() => { if (moduleBoundary && !expired && !runtime.finished) setEndModuleOpen(true); else void navigate("next"); }} onBack={() => void navigate("previous")} canBack={canBack}
      onReview={fullLength && sections[sectionIndex]?.name === "Reading" ? () => setReviewOpen(true) : undefined}
      nextDisabled={(!fullLength && !valid && !expired && !runtime.finished) || submitting || mediaBusy || runtime.phase === "stimulus" && !expired}
      busy={submitting} error={saveError} saving={savingDraft} finished={runtime.finished} lastQuestion={isLast}>
      <fieldset key={question.id} disabled={submitting || (expired && !mediaBusy) || runtime.finished} className="min-w-0">
        <QuestionRenderer question={question} value={answer} onChange={(value) => setAnswers((previous) => ({ ...previous, [question.id]: value }))}
          language="en"
          split={true} serifTitles={false} attemptId={attemptId} availableSeconds={timerRemaining} onMediaBusyChange={setMediaBusy}
          spokenPhase={qt.responseType === "AUDIO_RECORDING" && theme.examInterface === "toefl" ? runtime.phase === "prep" ? "answer" : runtime.phase : undefined}
          audioConsumed={fullLength && audioConsumed} autoPlayAudio={fullLength} onAudioStarted={onAudioStarted}
          allowSpeakingRecovery={fullLength && audioConsumed && !mediaBusy}
          onStimulusEnded={onStimulusEnded} />
      </fieldset>
    </ToeflExamLayout>
    {(reviewOpen || endModuleOpen) && <div className="fixed inset-0 z-50 grid place-items-center bg-[#18243880] p-5" role="presentation">
      <section ref={reviewDialogRef} role="dialog" aria-modal="true" aria-labelledby="toefl-review-title" className="max-h-[85dvh] w-full max-w-xl overflow-y-auto rounded-xl bg-white p-7 font-sans text-[#182438] shadow-xl">
        <h2 id="toefl-review-title" className="text-xl font-semibold">{endModuleOpen ? `End ${moduleNumber ? "module" : "section"}?` : "Review this module"}</h2>
        <p className="mt-3 text-sm leading-relaxed text-[#5a677c]">{endModuleOpen ? "You cannot return after continuing. Unanswered questions receive no credit. The timer continues while this window is open." : "You can return to questions you have already visited in this module. The timer continues."}</p>
        {sections[sectionIndex]?.name === "Reading" && <div className="mt-5 grid grid-cols-3 gap-2">{moduleQuestions.map((q, i) => {
          const visited = questions.indexOf(q) <= Math.max(index, questions.findIndex((item) => item.id === runtime.maxQuestionId));
          return <button key={q.id} type="button" disabled={!visited || submitting || expired} onClick={() => void jumpTo(q.id)}
            className="rounded-md border border-[#dce3ed] p-3 text-left text-xs disabled:opacity-40">
            <b>Task {i + 1}{flags[q.id] ? " ⚑" : ""}</b><span className="mt-1 block">{isAnswerValid(q, answers[q.id] ?? EMPTY_ANSWER) ? "Answered" : "Unanswered"}</span>
          </button>;
        })}</div>}
        {saveError && <p role="alert" className="mt-3 text-sm text-red-700">{saveError}</p>}
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={() => { setReviewOpen(false); setEndModuleOpen(false); }} className="rounded-md border px-4 py-2 text-sm">Return to question</button>
          {endModuleOpen && <button type="button" disabled={submitting || mediaBusy} onClick={() => void navigate("next")} className="rounded-md bg-[#2455a6] px-4 py-2 text-sm text-white disabled:opacity-40">{submitting ? "Saving…" : "Continue"}</button>}
        </div>
      </section>
    </div>}</>;
  }

  return (
    <div
      className={`fixed inset-0 z-40 flex flex-col overflow-y-auto ${fontClass}`}
      style={{
        ...cssVars,
        backgroundColor: "var(--xbg)",
        color: "var(--xink)",
        fontFamily: "var(--xfont-body), ui-sans-serif, system-ui, sans-serif",
      }}
    >
      <ExamTimer
        style={theme.timer.style}
        totalSeconds={timerTotal}
        remainingSeconds={timerRemaining}
        warnUnderSeconds={theme.timer.warnUnderSeconds}
      />

      {/* encabezado: fila superior + (TOEFL) stepper protagonista */}
      <header className="mx-auto w-full max-w-5xl px-6 pt-6">
        <div className="flex items-center justify-between gap-4">
          <QuestionFlag
            flagged={flags[question.id] ?? false}
            onToggle={() =>
              setFlags((f) => ({ ...f, [question.id]: !(f[question.id] ?? false) }))
            }
          />
          {!theme.showStepper && (
            <p
              className="text-sm font-medium"
              style={{ color: "var(--xmuted)", fontFamily: "var(--xfont-display)" }}
            >
              {examName}
            </p>
          )}
          <div className="w-24" aria-hidden />
        </div>

        {theme.showStepper && (
          <div className="mt-5 border-b pb-6" style={{ borderColor: "var(--xline)" }}>
            <SectionProgressStepper
              sections={sections.map((s) => s.name)}
              activeIndex={sectionIndex}
              style={theme.style.stepperStyle}
              serif={serif}
            />
          </div>
        )}
      </header>

      {/* progreso */}
      <div className="mx-auto w-full max-w-5xl px-6 pt-4 pb-1">
        {theme.progress.mode === "counter" ? (
          <p className="text-sm tabular-nums" style={{ color: "var(--xmuted)" }}>
            {sections.length > 1 && (
              <span style={{ fontFamily: "var(--xfont-display)", fontStyle: serif ? "italic" : "normal" }}>
                {sections[sectionIndex]?.name}
              </span>
            )}
            {sections.length > 1 && " · "}
            Pregunta {indexInSection + 1} de {sectionQuestions.length}
          </p>
        ) : (
          <div className="flex items-center gap-1.5" aria-label="Progreso">
            <span className="size-2 rounded-full" style={{ backgroundColor: "var(--xaccent2)" }} />
            <span className="size-1.5 rounded-full opacity-40" style={{ backgroundColor: "var(--xmuted)" }} />
            <span className="size-1.5 rounded-full opacity-25" style={{ backgroundColor: "var(--xmuted)" }} />
          </div>
        )}
      </div>

      {/* pregunta */}
      <main className="mx-auto flex w-full flex-1 flex-col px-6 pt-3 pb-6">
        <div
          key={question.id}
          className="q-enter mx-auto w-full border p-6 sm:p-9"
          style={{
            maxWidth: contentMax,
            borderColor: "var(--xline)",
            backgroundColor: "var(--xsurface)",
            borderRadius: "var(--xradius)",
          }}
        >
          {/* etiqueta de tipo de pregunta — chip lúdico (DET) / kicker serif (TOEFL) */}
          {serif ? (
            <p
              className="mb-5 text-[0.95rem]"
              style={{ fontFamily: "var(--xfont-display)", fontStyle: "italic", color: "var(--xaccent)" }}
            >
              {qt.name}
              {!qt.isScored && (
                <span style={{ color: "var(--xmuted)" }}> — se revisa en tu sesión en vivo</span>
              )}
            </p>
          ) : (
            <div className="mb-5 flex flex-wrap items-center gap-2">
              <span
                className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold"
                style={{
                  fontFamily: "var(--xfont-display)",
                  backgroundColor: "color-mix(in oklab, var(--xaccent) 22%, var(--xsurface))",
                  color: "var(--xink)",
                }}
              >
                {qt.name}
              </span>
              {!qt.isScored && (
                <span className="text-xs" style={{ color: "var(--xmuted)" }}>
                  se revisa en tu sesión en vivo
                </span>
              )}
            </div>
          )}

          <fieldset disabled={submitting || (expired && !mediaBusy) || runtime.finished} className="min-w-0">
          <QuestionRenderer
            question={question}
            value={answer}
            onChange={(v) => setAnswers((a) => ({ ...a, [question.id]: v }))}
            split={theme.layout.split}
            serifTitles={serif}
            attemptId={attemptId}
            availableSeconds={timerRemaining}
            onMediaBusyChange={setMediaBusy}
          />
          </fieldset>
        </div>

        <p className="mx-auto mt-3 text-xs" role="status" style={{ color: "var(--xmuted)" }}>
          {savingDraft ? "Guardando respuesta…" : expired ? "Tiempo terminado" : "Guardado automático activado"}
        </p>
        {saveError && (
          <p
            className="mx-auto mt-3 rounded-lg px-4 py-2 text-sm"
            style={{ backgroundColor: "color-mix(in oklab, var(--xwarn) 12%, transparent)", color: "var(--xwarn)" }}
            role="alert"
          >
            {saveError}
          </p>
        )}

        {/* navegación */}
        <div
          className={`mx-auto mt-7 flex w-full items-center ${
            canBack ? "justify-between" : "justify-center"
          }`}
          style={{ maxWidth: contentMax }}
        >
          {canBack && (
            <QuestionNavButton variant="back" onClick={() => void navigate("previous")} disabled={submitting}>
              ← Anterior
            </QuestionNavButton>
          )}
          <QuestionNavButton
            variant="primary"
            onClick={() => void navigate("next")}
            disabled={(!valid && !expired && !runtime.finished) || submitting || mediaBusy}
            style={{ minWidth: canBack ? undefined : "15rem" }}
          >
            {submitting
              ? "Guardando…"
              : runtime.finished
                ? "Reintentar envío"
                : expired
                  ? "Continuar al terminar el tiempo"
              : isLast
                ? "Terminar examen"
                : theme.navigation.allowBack
                  ? "Siguiente →"
                  : "Continuar"}
          </QuestionNavButton>
        </div>
      </main>

      <footer className="pb-4 text-center">
        <p className="text-xs" style={{ color: "var(--xmuted)" }}>
          {theme.disclaimer}
        </p>
      </footer>
    </div>
  );
}

const EMPTY_ANSWER: AnswerValue = {};
