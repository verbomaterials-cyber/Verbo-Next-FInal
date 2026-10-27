import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { AdminFieldSchema, ThemeConfig } from "@/lib/exam-config";
import { examFontClass } from "@/lib/fonts";
import { ExamEngine, type EngineSection } from "@/components/exam/exam-engine";
import type { EngineQuestion } from "@/components/exam/question-renderer";
import { getAttemptProgress } from "@/lib/student/actions";
import { studentQuestionPayload } from "@/lib/student/question-payload";
import { themeConfigZ } from "@/lib/exam-config";
import { delivered, deliveryMetadata } from "@/lib/toefl-delivery";
import { detMetadata, detPublicPrompt } from "@/lib/det-format";
import { DetEngine } from "@/components/exam/det-engine";

export default async function AttemptPage({
  params,
}: {
  params: Promise<{ attemptId: string }>;
}) {
  const { attemptId } = await params;
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "STUDENT") redirect("/login");

  const attempt = await prisma.attempt.findUnique({
    where: { id: attemptId },
    include: {
      responses: true,
      examVersion: {
        include: {
          examType: true,
          questions: {
            orderBy: { order: "asc" },
            include: { questionType: { include: { section: true } } },
          },
        },
      },
    },
  });

  if (!attempt || attempt.studentId !== session.user.id) notFound();
  if (attempt.status !== "IN_PROGRESS") redirect(`/alumno/resultado/${attempt.id}`);

  const examType = attempt.examVersion.examType;
  const questions = attempt.examVersion.questions;
  if (questions.length === 0) redirect(`/alumno/examen/${examType.slug}`);

  /*
   * Orden de presentación:
   * - FIXED: por sección (Section.order) y dentro por Question.order
   * - MIXED: por Question.order tal como se armó la versión
   */
  const sorted =
    examType.sectionOrderMode === "FIXED"
      ? [...questions].sort((a, b) => {
          const sa = a.questionType.section.order ?? 0;
          const sb = b.questionType.section.order ?? 0;
          return sa !== sb ? sa - sb : a.order - b.order || a.id.localeCompare(b.id);
        })
      : [...questions].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));

  // Secciones presentes, en orden de aparición
  const sections: EngineSection[] = [];
  for (const q of sorted) {
    const s = q.questionType.section;
    if (!sections.some((x) => x.id === s.id)) {
      sections.push({ id: s.id, name: s.name, durationMinutes: s.durationMinutes });
    }
  }

  const progress = await getAttemptProgress(attempt.id);
  if (!progress.ok || !progress.data) {
    return <p role="alert">{progress.ok ? "No se pudo recuperar el intento." : progress.error}</p>;
  }
  if (sorted.some(q=>detMetadata(q.promptContent))) {
    const current=sorted.find(q=>q.id===progress.data!.questionId);
    const meta=detMetadata(current?.promptContent);
    if(!current || !meta) return <p role="alert">No se pudo recuperar la pantalla de DET.</p>;
    const responseMap=new Map(attempt.responses.map(r=>[r.questionId,r.answerContent as Record<string,unknown>]));
    const previous=meta.previousKey?sorted.find(q=>detMetadata(q.promptContent)?.key===meta.previousKey):undefined;
    const currentIndex=sorted.indexOf(current);
    const logical=sorted.filter(q=>!detMetadata(q.promptContent)?.slot || detMetadata(q.promptContent)?.level===3);
    const history=meta.task==="listen-respond"?sorted.slice(0,currentIndex).filter(q=>detMetadata(q.promptContent)?.set===meta.set&&detMetadata(q.promptContent)?.task==="listen-respond"&&responseMap.has(q.id)).flatMap(q=>[
      {speaker:"Partner",text:String((q.promptContent as Record<string,unknown>)._transcript??"")},
      {speaker:"Best response",text:((q.promptContent as Record<string,unknown>).options as {options:string[]}).options[Number((q.correctAnswer as Record<string,unknown>).options)]},
    ]):undefined;
    const logicalIndex=logical.findIndex(q=>q.id===current.id || meta.slot&&detMetadata(q.promptContent)?.slot===meta.slot);
    return <div className={examFontClass}><DetEngine key={current.id} attemptId={attempt.id} initialRuntime={progress.data} screen={{id:current.id,name:current.questionType.name,
      prompt:detPublicPrompt(current.promptContent as Record<string,unknown>),meta,
      answer:responseMap.get(current.id)??{}, previousText:previous?String(responseMap.get(previous.id)?.text??""):undefined,history,progress:Math.max(0,logicalIndex),total:logical.length}}/></div>;
  }
  const engineQuestions: EngineQuestion[] = sorted.filter((q) => delivered(deliveryMetadata(q.promptContent), progress.data?.routes ?? {})).map((q) => {
    const delivery = deliveryMetadata(q.promptContent);
    const payload = studentQuestionPayload(q.questionType.adminFieldSchema as AdminFieldSchema,
      q.promptContent as Record<string, unknown>, q.questionType.responseType);
    return ({
    id: q.id,
    order: q.order,
    promptContent: payload.prompt,
    itemCount: q.questionType.responseType === "FILL_BLANK" && Array.isArray((q.correctAnswer as Record<string, unknown> | null)?.answers) ? ((q.correctAnswer as Record<string, unknown>).answers as unknown[]).length : 1,
    module: delivery && delivery.module !== "linear" ? { id: `${delivery.section}-${delivery.module}`, number: delivery.module === "router" ? 1 : 2 } : undefined,
    questionType: {
      id: q.questionType.id,
      name: q.questionType.name,
      inputMedia: q.questionType.inputMedia,
      responseType: q.questionType.responseType,
      timingMode: q.questionType.timingMode,
      timePerItemSeconds: delivery?.responseSeconds ?? q.questionType.timePerItemSeconds,
      prepTimeSeconds: q.questionType.prepTimeSeconds,
      replaysAllowed: q.questionType.replaysAllowed,
      isScored: q.questionType.isScored,
      sectionId: q.questionType.sectionId,
      adminFieldSchema: payload.schema,
      timingGroupKey: delivery && delivery.module !== "linear" ? `${delivery.section}-${delivery.module}` : (q.questionType.adminFieldSchema as AdminFieldSchema).timingGroup?.key,
    },
  }); });

  const initialAnswers = Object.fromEntries(
    attempt.responses.map((r) => [r.questionId, r.answerContent as Record<string, unknown>]),
  );
  const initialFlags = Object.fromEntries(
    attempt.responses.map((r) => [r.questionId, r.isFlagged]),
  );

  return (
    <ExamEngine
      key={JSON.stringify(progress.data.routes ?? {})}
      attemptId={attempt.id}
      examName={examType.name}
      examSlug={examType.slug}
      theme={themeConfigZ.parse(examType.themeConfig) as ThemeConfig}
      fontClass={examFontClass}
      sections={sections}
      questions={engineQuestions}
      initialAnswers={initialAnswers}
      initialFlags={initialFlags}
      initialRuntime={progress.data}
      fullLength={sorted.some((q) => deliveryMetadata(q.promptContent))}
    />
  );
}
