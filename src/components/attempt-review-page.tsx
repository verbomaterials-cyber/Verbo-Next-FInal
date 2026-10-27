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
        include: { question: { include: { questionType: true } } },
        orderBy: { question: { order: "asc" } },
      },
      examVersion: { include: { examType: { select: { name: true } } } },
    },
  });
  if (!attempt) notFound();

  const openResponses = attempt.responses.filter((r) =>
    OPEN_TYPES.has(r.question.questionType.responseType) || detMetadata(r.question.promptContent)?.task==="listen-complete"&&(r.isCorrect===null || detAssessmentZ.safeParse(r.reviewAssessment).success),
  );
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
    </div>
  );
}

