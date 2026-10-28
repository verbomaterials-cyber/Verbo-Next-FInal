import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { answerSummary, ReviewPrompt } from "@/components/response-review-content";
import { getAppSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui";
import { delivered, deliveryMetadata, type RouteDecision } from "@/lib/toefl-delivery";
import { rubricAssessmentZ } from "@/lib/toefl-rubrics";
import { detMetadata, detDelivered, detAssessmentZ, detPoints } from "@/lib/det-format";
import { PracticeCertificate } from "@/components/practice-certificate";
import { buildAttemptInsights } from "@/lib/attempt-insights";
import { AttemptSkillSummary } from "@/components/attempt-skill-summary";
import { TeacherReportView } from "@/components/teacher-report";
import { publishedTeacherReport } from "@/lib/teacher/report";
import { loadExamContent } from "@/lib/exam-content";

export default async function ResultPage({
  params,
}: {
  params: Promise<{ attemptId: string }>;
}) {
  const { attemptId } = await params;
  const session = await getAppSession();
  if (!session || session.user.role !== "STUDENT") redirect("/login");

  const row = await prisma.attempt.findUnique({
    where: { id: attemptId, studentId: session.user.id },
    include: {
      student: { select: { fullName: true } },
      responses: { include: { question: { include: { questionType: true } } } },
    },
  });
  if (!row) notFound();
  if (row.status === "IN_PROGRESS") redirect(`/alumno/intento/${row.id}`);
  const attempt = { ...row, examVersion: await loadExamContent(row.examVersionId) };
  const routes = (attempt.runtimeState as { routes?: Record<string, RouteDecision> } | null)?.routes ?? {};
  const detSelections=(attempt.runtimeState as {detSelections?:Record<string,string>}|null)?.detSelections??{};
  const det=attempt.examVersion.questions.some(q=>detMetadata(q.promptContent));
  const deliveredQuestions = attempt.examVersion.questions.filter((q) => delivered(deliveryMetadata(q.promptContent), routes)&&detDelivered(detMetadata(q.promptContent),q.id,detSelections));
  const fullLength = deliveredQuestions.some((q) => deliveryMetadata(q.promptContent));

  const insights = buildAttemptInsights(attempt.examVersion.questions, attempt.responses, attempt.runtimeState, attempt.overallScore);
  const teacherReport = publishedTeacherReport(attempt.teacherReport);
  const examType = attempt.examVersion.examType;
  const hasFeedback = attempt.examVersion.hasFeedback;
  const overall = (attempt.overallScore ?? {}) as {
    value?: number | null;
    band?: number;
    pending?: boolean;
    raw?: Record<string, { earned: number; possible: number; pending: number }>;
  };
  const subscores = (attempt.subscores ?? {}) as Record<string, number>;
  const subscoreNames = (examType.subscoreDefinitions as string[]).filter(
    (n) => subscores[n] !== undefined,
  );
  const pending = attempt.status === "PENDING_REVIEW";
  const responsesByQuestion = new Map(attempt.responses.map((r) => [r.questionId, r]));

  const graded = deliveredQuestions.filter(
    (q) => responsesByQuestion.get(q.id)?.isCorrect !== null && responsesByQuestion.has(q.id),
  );
  const correctCount = deliveredQuestions.filter(
    (q) => responsesByQuestion.get(q.id)?.isCorrect === true,
  ).length;

  return (
    <div className="rise-in mx-auto max-w-2xl result-content">
      <p className="text-sm text-ink-muted">
        {examType.name} · {attempt.examVersion.label}
      </p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">Tus resultados</h1>
      {(attempt.runtimeState as { demo?: boolean } | null)?.demo && <p className="mt-4 rounded-xl bg-brand-soft p-4 text-sm text-brand">Demostración con respuestas y evaluaciones ficticias. Los audios son tonos de prueba; estos resultados no pertenecen a un alumno real.</p>}
      {!pending && <PracticeCertificate name={attempt.student.fullName} exam={examType.name} version={attempt.examVersion.label} attemptId={attempt.id} date={attempt.completedAt ?? attempt.startedAt} overallScore={attempt.overallScore} subscores={attempt.subscores} />}

      {pending && (
        <p className="mt-4 rounded-xl bg-brand-soft px-4 py-3 text-sm leading-relaxed text-brand">
          Resultado parcial: {det?"tus respuestas abiertas y las paráfrasis que necesitan interpretación":"tus respuestas de escritura y speaking"} se revisarán
          contigo en tu próxima sesión en vivo. Tu puntaje puede ajustarse
          después de esa revisión.
        </p>
      )}

      {/* score principal */}
      <div className="mt-6 rounded-2xl border border-line bg-surface p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm text-ink-muted">{det ? "Índice de práctica · 0–100" : fullLength ? "Banda de práctica" : "Puntaje general"}{pending && " (parcial)"}</p>
            <p className="mt-1 font-mono text-5xl font-semibold tracking-tight">
              {overall.value ?? "—"}
            </p>
          </div>
          {overall.band !== undefined && (
            <div className="text-right">
              <p className="text-sm text-ink-muted">Banda</p>
              <p className="mt-1 font-mono text-3xl font-semibold">{overall.band.toFixed(1)}</p>
            </div>
          )}
          <p className="text-sm text-ink-muted">
            {!fullLength && graded.length > 0 && `${correctCount} de ${graded.length} calificadas correctas`}
          </p>
        </div>

        {subscoreNames.length > 0 && (
          <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-3 border-t border-line pt-5 sm:grid-cols-4">
            {subscoreNames.map((name) => (
              <div key={name}>
                <dt className="text-xs text-ink-muted">{name}</dt>
                <dd className="font-mono text-lg font-semibold">{subscores[name]}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
      {det && <section className="mt-5 rounded-xl border border-line bg-surface p-5">
        <p className="text-sm leading-relaxed text-ink-muted">Este índice usa crédito parcial y rúbricas de práctica. No está calibrado ni equivale al puntaje oficial DET de 10–160. Se calcula al terminar la revisión de las cuatro habilidades. La adaptación de las tareas cortas utiliza una regla editorial; las preguntas de seguimiento orales están predefinidas.</p>
        <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">{Object.entries(overall.raw??{}).map(([name,s])=><div key={name}><dt className="text-sm font-medium">{name}</dt><dd className="mt-1 font-mono">{Number(s.earned.toFixed(2))}/{s.possible}</dd><dd className="mt-1 text-xs text-ink-muted">{s.pending?`${s.pending} por revisar`:"puntos de práctica"}</dd></div>)}</dl>
      </section>}
      {fullLength && <section className="mt-5 rounded-xl border border-line bg-surface p-5">
        <p className="text-sm leading-relaxed text-ink-muted">La banda de práctica usa una conversión interna sin calibrar. No representa una predicción del puntaje ETS. El resultado general se calcula cuando las cuatro secciones están evaluadas.</p>
        <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">{Object.entries(overall.raw ?? {}).map(([name, score]) => <div key={name}>
          <dt className="text-sm font-medium">{name}</dt><dd className="mt-1 font-mono text-lg">{score.earned}/{score.possible}</dd>
          <dd className="mt-1 text-xs text-ink-muted">{score.pending ? `${score.pending} por revisar` : "puntos de práctica"}</dd>
        </div>)}</dl>
        <p className="mt-4 text-xs text-ink-muted">Reading y Listening incluyen reactivos de prueba que no suman puntos. Las respuestas abiertas se evalúan de 0 a 5.</p>
      </section>}

      <AttemptSkillSummary insights={insights} />
      {teacherReport ? <TeacherReportView report={teacherReport} studentName={attempt.student.fullName} examName={`${examType.name} · ${attempt.examVersion.label}`} attemptId={attempt.id} /> : <section className="mt-6 rounded-xl border border-line p-5"><h2 className="font-semibold">Tu reporte personalizado</h2><p className="mt-2 text-sm text-ink-muted">Ya puedes consultar el resumen automático. Tu profesor revisará tus respuestas y publicará aquí sus observaciones y tu plan de estudio.</p></section>}

      {/* desglose por pregunta (solo versiones con feedback) */}
      {hasFeedback ? (
        <section className="mt-8">
          <h2 className="font-semibold tracking-tight">Revisión por pregunta</h2>
          <ol className="mt-4 space-y-3">
            {deliveredQuestions.map((q, index) => {
              const r = responsesByQuestion.get(q.id);
              const assessment = (det?detAssessmentZ:rubricAssessmentZ).safeParse(r?.reviewAssessment);
              const meta = deliveryMetadata(q.promptContent);
              const open =
                q.questionType.responseType === "FREE_TEXT" ||
                q.questionType.responseType === "AUDIO_RECORDING";
              const state = !r
                ? "sin responder"
                : assessment.success ? `${assessment.data.score}/5 · evaluada` : r.isCorrect === true
                  ? "correcta"
                  : r.isCorrect === false
                    ? "incorrecta"
                    : "por revisar";
              return (
                <li key={q.id} className="rounded-xl border border-line bg-surface p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs text-ink-muted">#{index + 1}</span>
                    <span className="text-sm font-medium">{q.questionType.name}</span>
                    {r?.isFlagged && <Badge tone="brand">tu duda 🚩</Badge>}
                    <span className="ml-auto">
                      <Badge
                        tone={
                          state === "correcta"
                            ? "success"
                            : state === "incorrecta" || state === "sin responder"
                              ? "warning"
                              : "neutral"
                        }
                      >
                        {state}
                      </Badge>
                    </span>
                  </div>

                  {r && (
                    <p className="mt-2 text-sm text-ink-muted">
                      Tu respuesta: {answerSummary(r.answerContent as Record<string, unknown>, q.promptContent as Record<string, unknown>)}
                    </p>
                  )}
                  {(fullLength || det) && <details className="mt-3 text-sm"><summary className="cursor-pointer font-medium">Ver consigna y revisión</summary>
                    <ReviewPrompt prompt={q.promptContent as Record<string, unknown>} correct={q.correctAnswer as Record<string, unknown> | null} />
                    {meta?.scored === false && <p className="mt-2 text-xs text-ink-muted">Reactivo de prueba: no suma puntos.</p>}
                    {det&&!open&&<p className="mt-2 text-xs text-ink-muted">Crédito de práctica: {assessment.success&&detMetadata(q.promptContent)?.task==="listen-complete"?(assessment.data.score/5*detPoints(q.promptContent as Record<string,unknown>,q.correctAnswer as Record<string,unknown>|null).possible).toFixed(2):r?.isCorrect===null?"por revisar":detPoints(q.promptContent as Record<string,unknown>,q.correctAnswer as Record<string,unknown>|null,(r?.answerContent??{})as Record<string,unknown>).earned.toFixed(2)} / {detPoints(q.promptContent as Record<string,unknown>,q.correctAnswer as Record<string,unknown>|null).possible}</p>}
                  </details>}
                  {r && typeof (r.answerContent as Record<string, unknown>).audioUrl === "string" && (r.answerContent as Record<string, unknown>).recordingId != null && <audio preload="none" controls className="mt-3 w-full" aria-label="Tu respuesta oral" src={String((r.answerContent as Record<string, unknown>).audioUrl)} />}

                  {open && r && r.isCorrect === null && (
                    <p className="mt-2 rounded-lg bg-brand-soft px-3 py-2 text-sm text-brand">
                      Esta respuesta se revisará contigo en tu próxima sesión en vivo.
                    </p>
                  )}

                  {r?.reviewNotes && (
                    <p className="mt-2 rounded-lg bg-background px-3 py-2 text-sm leading-relaxed">
                      <span className="font-medium">Notas de tu asesor:</span> {r.reviewNotes}
                    </p>
                  )}

                  {q.feedbackText && r && r.isCorrect !== null && (
                    <p className="mt-2 text-sm leading-relaxed text-ink-muted">
                      <span className="font-medium text-ink">¿Por qué?</span> {q.feedbackText}
                    </p>
                  )}
                </li>
              );
            })}
          </ol>
        </section>
      ) : (
        <p className="mt-6 text-sm leading-relaxed text-ink-muted">
          El Diagnóstico mide tu punto de partida, por eso no incluye feedback
          por pregunta. Tu asesor usará estos resultados en tu sesión de tips.
        </p>
      )}

      <Link
        href="/alumno"
        className="mt-8 inline-block rounded-lg bg-brand px-5 py-2.5 text-sm font-medium text-white transition-colors duration-150 hover:bg-brand-strong"
      >
        Volver a mis exámenes
      </Link>
      {fullLength && <Link href="/alumno/progreso/toefl-ibt" className="mt-5 ml-4 inline-block text-sm font-medium text-brand underline-offset-4 hover:underline">Comparar mis resultados →</Link>}
    </div>
  );
}
