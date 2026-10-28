import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui";
import { ReviewPanel } from "@/app/admin/revision/[attemptId]/review-panel";
import { getAppSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { detMetadata, detAssessmentZ } from "@/lib/det-format";
import { optimizedMedia } from "@/lib/media";
import { buildAttemptInsights, answerStateLabels } from "@/lib/attempt-insights";
import { AttemptSkillSummary } from "./attempt-skill-summary";
import { TeacherReportForm } from "./teacher-report-form";
import { readTeacherReport } from "@/lib/teacher/report";
import { answerSummary, ReviewPrompt } from "./response-review-content";
import { loadExamContent } from "@/lib/exam-content";

export const metadata: Metadata = { title: "Revisión de intento" };

const OPEN_TYPES = new Set(["FREE_TEXT", "AUDIO_RECORDING"]);

export default async function ReviewAttemptPage({
  params,
}: {
  params: Promise<{ attemptId: string }>;
}) {
  const { attemptId } = await params;
  const session = await getAppSession();
  if (!session || !["ADMIN", "TEACHER"].includes(session.user.role)) redirect("/login");
  const teacher = session.user.role === "TEACHER";

  const attempt = await prisma.attempt.findUnique({
    where: { id: attemptId, ...(teacher ? { student: { teacherId: session.user.id }, status: { not: "IN_PROGRESS" as const } } : {}) },
    include: {
      student: { select: { fullName: true, email: true } },
      responses: {
        include: { question: { include: { questionType: { include: { section: true } } } } },
        orderBy: { question: { order: "asc" } },
      },
      examVersion: { include: { examType: { select: { name: true } } } },
    },
  });
  if (!attempt) notFound();
  if (attempt.status === "IN_PROGRESS") return <p>El alumno todavía está contestando. La revisión estará disponible cuando envíe el intento.</p>;
  const version = await loadExamContent(attempt.examVersionId);
  const insights = buildAttemptInsights(version.questions, attempt.responses, attempt.runtimeState, attempt.overallScore);
  const deliveredIds = new Set(insights.items.map(i => i.question.id));

  const openResponses = attempt.responses.filter((r) =>
    deliveredIds.has(r.questionId) && (OPEN_TYPES.has(r.question.questionType.responseType) || detMetadata(r.question.promptContent)?.task==="listen-complete"&&(r.isCorrect===null || detAssessmentZ.safeParse(r.reviewAssessment).success)),
  );
  const closedItems = insights.items.filter(i => !OPEN_TYPES.has(i.question.questionType.responseType));
  const needsAttention = closedItems.filter(i => i.status !== "correct" && i.status !== "unscored" || i.response?.isFlagged);
  const otherItems = closedItems.filter(i => !needsAttention.includes(i));
  const overall = (attempt.overallScore ?? {}) as { value?: number | null; scoringVersion?: string };

  return (
    <div className="rise-in">
      <nav className="text-sm text-ink-muted">
        <Link href={teacher ? "/profesor" : "/admin/metricas"} className="hover:text-brand">
          {teacher ? "Mis revisiones" : "Métricas"}
        </Link>
        <span aria-hidden> / </span>
        <span className="text-ink">Revisión</span>
      </nav>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">
          {attempt.student.fullName}
        </h1>
        <Badge tone={attempt.status === "PENDING_REVIEW" ? "warning" : "success"}>
          {attempt.status === "PENDING_REVIEW" ? "por revisar" : "completado"}
        </Badge>
      </div>
      <p className="mt-1 text-sm text-ink-muted">
        {attempt.examVersion.examType.name} · {attempt.examVersion.label} ·
        completado {attempt.completedAt?.toISOString().slice(0, 16).replace("T", " ")} ·
        {overall.scoringVersion==="verbo-det-practice-v1"?"índice de práctica 0–100":"score actual"}: <span className="font-mono">{overall.value ?? "—"}</span>
      </p>
      {(attempt.runtimeState as { demo?: boolean } | null)?.demo && <p className="mt-5 rounded-xl bg-brand-soft p-4 text-sm text-brand">Demostración: estas respuestas y evaluaciones son ficticias. Los audios son tonos de prueba y no representan el desempeño de un alumno.</p>}

      <AttemptSkillSummary insights={insights} />
      <nav aria-label="Secciones de la revisión" className="mt-5 flex flex-wrap gap-5 text-sm font-medium text-brand"><a href="#respuestas-cerradas">Errores y aciertos</a><a href="#evaluacion-manual">Evaluar respuestas abiertas</a><a href="#reporte-docente">Preparar reporte</a></nav>
      <section className="mt-8" id="respuestas-cerradas">
        <h2 className="text-lg font-semibold">Primero, lo que necesita atención</h2>
        <p className="mt-2 text-sm text-ink-muted">{insights.counts.incorrect} incorrectas · {insights.counts.partial} con crédito parcial · {insights.counts.omitted} sin responder · {insights.counts.pending} por revisar. Solo se muestran tareas del recorrido de este alumno.</p>
        <div className="mt-4 space-y-3">{needsAttention.map(item => <ClosedResponse key={item.question.id} item={item} />)}</div>
        {!needsAttention.length && <p className="mt-4 text-sm text-ink-muted">No hay errores ni dudas en las tareas cerradas.</p>}
        <details className="mt-5 rounded-xl border border-line bg-surface p-4"><summary className="cursor-pointer font-medium">Aciertos y tareas sin puntuación ({otherItems.length})</summary><div className="mt-4 space-y-3">{otherItems.map(item => <ClosedResponse key={item.question.id} item={item} />)}</div></details>
      </section>

      <h2 className="mt-9 text-lg font-semibold" id="evaluacion-manual">Evaluación de escritura, speaking y respuestas interpretables</h2>

      {openResponses.length === 0 ? (
        <p className="mt-8 rounded-xl border border-dashed border-line px-6 py-10 text-center text-sm text-ink-muted">
          Este intento no tiene respuestas abiertas que revisar.
        </p>
      ) : (
        <div className="mt-8">
          <ReviewPanel
            responses={openResponses.map((r) => ({
              id: r.id,
              questionOrder: r.question.order,
              typeName: r.question.questionType.name,
              responseType: r.question.questionType.responseType,
              isScored: r.question.questionType.isScored,
              isFlagged: r.isFlagged,
              isCorrect: r.isCorrect,
              reviewNotes: r.reviewNotes,
              reviewAssessment: r.reviewAssessment,
              promptContent: optimizedMedia(r.question.promptContent) as Record<string, unknown>,
              answerContent: r.answerContent as Record<string, unknown>,
            }))}
          />
        </div>
      )}
      <TeacherReportForm key={`${attempt.id}:${readTeacherReport(attempt.teacherReport)?.revision ?? 0}`} attemptId={attempt.id} report={readTeacherReport(attempt.teacherReport)} completed={attempt.status === "COMPLETED"} />
    </div>
  );
}

function ClosedResponse({ item }: { item: ReturnType<typeof buildAttemptInsights>["items"][number] }) {
  const prompt = optimizedMedia(item.question.promptContent) as Record<string, unknown>;
  return <details className="rounded-xl border border-line bg-surface p-4">
    <summary className="cursor-pointer text-sm"><span className="font-mono text-ink-muted">#{item.index}</span> <strong>{item.question.questionType.name}</strong> · {item.skills.join(" / ")} · {answerStateLabels[item.status]}{item.response?.isFlagged ? " · Duda del alumno" : ""}</summary>
    <p className="mt-3 whitespace-pre-wrap text-sm"><strong>Respuesta del alumno: </strong>{item.response ? answerSummary(item.response.answerContent as Record<string, unknown>, prompt) : "Sin responder"}</p>
    {item.possible > 0 && <p className="mt-2 text-xs text-ink-muted">{item.status === "pending" ? "Puntuación pendiente de revisión" : `${Number(item.earned.toFixed(2))} / ${item.possible} puntos de práctica`}</p>}
    <ReviewPrompt prompt={prompt} correct={item.question.correctAnswer as Record<string, unknown> | null} />
  </details>;
}

