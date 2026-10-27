"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import { formatTime } from "./exam-timer";
import { toeflTaskInstructions } from "@/lib/toefl-format";

const toeflVariables = {
  "--xbg": "#F4F6FA", "--xsurface": "#FFFFFF", "--xink": "#182438", "--xmuted": "#5A677C",
  "--xaccent": "#2455A6", "--xaccent2": "#173D7C", "--xline": "#DCE3ED", "--xwarn": "#B74116",
  "--xfont-display": "Arial", "--xfont-body": "Arial", "--xcontrol": "6px",
} as CSSProperties;

export function ToeflExamLayout({
  sections, activeSection, questionName, questionNumber, questionCount, seconds,
  phase, children, flagged, onFlag, onNext, onBack, canBack, nextDisabled,
  busy, error, saving, finished, lastQuestion, preview = false,
  moduleNumber, onReview,
}: {
  sections: string[]; activeSection: number; questionName: string; questionNumber: number | string;
  questionCount: number; seconds: number; phase?: "stimulus" | "answer"; children: ReactNode;
  flagged: boolean; onFlag: () => void; onNext: () => void; onBack: () => void;
  canBack: boolean; nextDisabled: boolean; busy: boolean; error: string | null;
  saving: boolean; finished: boolean; lastQuestion: boolean; preview?: boolean;
  moduleNumber?: 1 | 2; onReview?: () => void;
}) {
  const [hideTime, setHideTime] = useState(false);
  return (
    <div className="toefl-exam fixed inset-0 z-40 flex flex-col overflow-hidden bg-[#f4f6fa] text-[#182438]"
      style={{ ...toeflVariables, top: preview ? 56 : 0, fontFamily: "Arial, Helvetica, sans-serif" }}>
      <header className="shrink-0 border-b border-[#dce3ed] bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 sm:px-9">
          <div className="flex items-center gap-4">
            <div className="grid size-10 place-items-center rounded-lg bg-[#173d7c] text-sm font-bold text-white" aria-hidden>T</div>
            <div><p className="text-xl font-bold tracking-tight">TOEFL iBT<span className="align-top text-[10px]">®</span></p>
              <p className="mt-0.5 text-[10px] tracking-[0.18em] text-[#69758a]">VERBO NEXT {preview ? "· PREVIEW" : ""}</p></div>
          </div>
          <div className="flex items-center gap-3 sm:gap-6">
            <details className="relative text-sm">
              <summary className="cursor-pointer rounded-md px-2 py-2 text-[#475870] hover:bg-[#f4f6fa]">Help</summary>
              <div className="absolute right-0 top-10 z-50 w-72 rounded-lg border border-[#dce3ed] bg-white p-5 text-sm leading-relaxed shadow-lg">
                {toeflTaskInstructions(questionName)} The clock continues while this help is open.
              </div>
            </details>
            <div className="border-l border-[#dce3ed] pl-4 sm:pl-6">
              <p className="text-[10px] font-semibold tracking-[0.12em] text-[#69758a]">{phase === "stimulus" ? "LISTEN TO THE PROMPT" : "TIME REMAINING"}</p>
              <div className="mt-1 flex items-center gap-3">
                <span role="timer" aria-label={hideTime ? "Timer hidden" : `Time remaining: ${formatTime(seconds)}`}
                  className={`min-w-16 text-[22px] leading-none font-semibold tabular-nums ${seconds < 60 ? "text-[#b74116]" : "text-[#182438]"}`}>
                  {hideTime ? "—:—" : formatTime(seconds)}
                </span>
                <button type="button" className="text-xs text-[#69758a] underline underline-offset-4" onClick={() => setHideTime(!hideTime)}>
                  {hideTime ? "Show" : "Hide"}
                </button>
              </div>
            </div>
          </div>
        </div>
        <nav aria-label="Test sections" className="mx-auto flex max-w-7xl overflow-x-auto px-5 sm:px-9">
          {sections.map((section, index) => <div key={section} aria-current={index === activeSection ? "step" : undefined}
            className={`flex min-w-fit flex-1 items-center gap-2 border-b-[3px] px-3 py-3 text-xs sm:text-sm ${index === activeSection ? "border-[#2455a6] font-semibold text-[#173d7c]" : "border-transparent text-[#8390a2]"}`}>
            <span className={`grid size-5 shrink-0 place-items-center rounded-full text-[10px] ${index === activeSection ? "bg-[#e8effb] text-[#2455a6]" : "bg-[#f2f4f8]"}`}>{index < activeSection ? "✓" : index + 1}</span>
            {section}
          </div>)}
        </nav>
      </header>

      <main className="mx-auto flex min-h-0 w-full max-w-7xl flex-1 flex-col overflow-y-auto px-4 py-5 sm:px-9 sm:py-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div><p className="mb-1.5 text-[10px] font-bold tracking-[0.16em] text-[#69758a]">{sections[activeSection]?.toUpperCase()}{moduleNumber ? ` · MODULE ${moduleNumber} OF 2` : ""}</p>
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{questionName}</h1></div>
          <p className="rounded-full border border-[#dce3ed] bg-white px-4 py-2 text-xs text-[#5a677c]">Question <b className="text-[#182438]">{questionNumber}</b> of {questionCount}</p>
        </div>
        <p className="mb-5 max-w-3xl text-sm leading-relaxed text-[#5a677c]">{toeflTaskInstructions(questionName)}</p>
        <section aria-label="Question" className="min-w-0 shrink-0 flex-1 rounded-xl border border-[#dce3ed] bg-white p-5 shadow-[0_2px_8px_#18243804] sm:p-8">
          {children}
        </section>
        {error && <p role="alert" className="mt-3 rounded-md border border-[#f1d1c6] bg-[#fff6f2] p-3 text-sm text-[#a33715]">{error}</p>}
      </main>

      <footer className="sticky bottom-0 shrink-0 border-t border-[#dce3ed] bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-4 sm:px-9">
          <div className="flex items-center gap-4">
            <button type="button" onClick={onFlag} aria-pressed={flagged} disabled={busy || finished || preview}
              className={`rounded-md border px-3 py-2 text-xs transition-colors ${flagged ? "border-[#2455a6] bg-[#eef3fc] text-[#173d7c]" : "border-[#dce3ed] text-[#5a677c]"}`}>
              {flagged ? "⚑ Marked for review" : "⚐ Mark for review"}
            </button>
            <p role="status" className="hidden text-[11px] text-[#8390a2] sm:block">{preview ? "Interactive design preview" : saving ? "Saving…" : busy ? "Please wait…" : "Your answers are saved automatically"}</p>
          </div>
          <div className="ml-auto flex items-center gap-3">
            {onReview && <button type="button" onClick={onReview} disabled={busy || finished} className="rounded-md border border-[#c6d2e4] px-4 py-2.5 text-sm font-semibold text-[#173d7c] disabled:opacity-40">Review</button>}
            {canBack && <button type="button" onClick={onBack} disabled={busy} className="rounded-md border border-[#c6d2e4] px-5 py-2.5 text-sm font-semibold text-[#173d7c] disabled:opacity-40">Back</button>}
            <button type="button" onClick={onNext} disabled={nextDisabled}
              className="min-w-32 rounded-md bg-[#2455a6] px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#173d7c] disabled:cursor-not-allowed disabled:opacity-35">
              {busy ? "Saving…" : finished ? "Retry submission" : lastQuestion ? "Finish test" : "Next →"}
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
