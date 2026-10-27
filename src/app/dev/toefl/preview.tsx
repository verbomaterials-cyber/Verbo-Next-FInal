"use client";

import { useState } from "react";
import Link from "next/link";
import { ToeflExamLayout } from "@/components/exam/toefl-exam-layout";
import { QuestionRenderer, type AnswerValue, type EngineQuestion } from "@/components/exam/question-renderer";
import { TOEFL_FORMAT } from "@/lib/toefl-format";

const ignoreBusy = () => {};
export function ToeflPreview({ questions, fullLength = false, formLabel = "Simulador 1" }: { questions: EngineQuestion[]; fullLength?: boolean; formLabel?: string }) {
  const [index, setIndex] = useState(fullLength ? 0 : 2);
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
  const question = questions[index];
  const activeSection = TOEFL_FORMAT.sections.findIndex((section) => section.name === question.questionType.sectionId);
  const inSection = questions.filter((item) => item.questionType.sectionId === question.questionType.sectionId && (!fullLength || item.module?.id === question.module?.id));
  const itemStart = inSection.slice(0, inSection.findIndex((q) => q.id === question.id)).reduce((total, q) => total + (q.itemCount ?? 1), 0) + 1;
  return <>
    <div className="fixed inset-x-0 top-0 z-50 flex h-14 items-center justify-between gap-4 bg-[#10233e] px-5 text-xs text-white">
      <label className="flex min-w-0 items-center gap-3"><span className="hidden shrink-0 sm:inline">{fullLength ? `${formLabel} · Vista de desarrollo` : "Vista de desarrollo · TOEFL 2026"}</span>
        <select aria-label="Task preview" className="min-w-0 rounded border border-white/25 bg-[#17304f] px-3 py-2 text-white"
          value={index} onChange={(event) => setIndex(Number(event.target.value))}>
          {questions.map((item, i) => <option key={item.id} value={i}>{fullLength ? `${i + 1}. ` : ""}{item.questionType.name}{item.module ? ` · Module ${item.module.number}` : ""}</option>)}
        </select>
      </label>
      <Link href="/alumno" className="shrink-0 rounded border border-white/25 px-3 py-2">Abrir como alumno →</Link>
    </div>
    <ToeflExamLayout preview sections={TOEFL_FORMAT.sections.map((section) => section.name)} activeSection={activeSection}
      moduleNumber={question.module?.number}
      questionName={question.questionType.name} questionNumber={fullLength ? (question.itemCount ?? 1) > 1 ? `${itemStart}–${itemStart + (question.itemCount ?? 1) - 1}` : itemStart : inSection.findIndex((item) => item.id === question.id) + 1}
      questionCount={fullLength ? inSection.reduce((total, q) => total + (q.itemCount ?? 1), 0) : inSection.length} seconds={question.questionType.adminFieldSchema.timingGroup?.durationSeconds ?? question.questionType.timePerItemSeconds ?? TOEFL_FORMAT.sections[activeSection].minutes * 60}
      flagged={false} onFlag={() => {}} onNext={() => setIndex((index + 1) % questions.length)}
      onBack={() => setIndex(Math.max(0, index - 1))} canBack={index > 0} nextDisabled={false}
      busy={false} error={null} saving={false} finished={false} lastQuestion={false}>
      <QuestionRenderer key={question.id} previewMode language="en" question={question} value={answers[question.id] ?? {}}
        onChange={(value) => setAnswers((previous) => ({ ...previous, [question.id]: value }))} split serifTitles={false}
        attemptId="preview" availableSeconds={600} onMediaBusyChange={ignoreBusy} />
    </ToeflExamLayout>
  </>;
}
