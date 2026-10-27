import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasExamAccess } from "@/lib/student/actions";
import { ToeflProgressReport } from "@/components/toefl-progress-report";
export default async function ProgressPage({ params }: { params: Promise<{ slug: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "STUDENT") redirect("/login");
  const { slug } = await params;
  if (slug !== "toefl-ibt") notFound();
  const enrollment = await prisma.enrollment.findFirst({ where: { studentId: session.user.id, examType: { slug } } });
  if (!enrollment || enrollment.isBlocked) redirect("/alumno");
  if (!await hasExamAccess(enrollment.id)) redirect(`/alumno/examen/${slug}`);
  const attempts = await prisma.attempt.findMany({ where: { studentId: session.user.id, examVersion: { examTypeId: enrollment.examTypeId }, status: { in: ["COMPLETED", "PENDING_REVIEW"] } },
    select: { id: true, status: true, startedAt: true, completedAt: true, overallScore: true, examVersion: { select: { label: true } } }, orderBy: { completedAt: "asc" } });
  return <div className="rise-in mx-auto max-w-5xl"><Link href={`/alumno/examen/${slug}`} className="text-sm text-ink-muted hover:text-brand">← Mis versiones TOEFL</Link>
    <p className="mt-7 text-xs font-semibold tracking-[.15em] text-brand">TOEFL iBT</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Mi progreso</h1>
    <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-muted">Compara los puntos de tus simulaciones completas, consulta el feedback y prepara tu siguiente sesión con el profesor.</p>
    <ToeflProgressReport attempts={attempts.map((attempt) => ({ ...attempt, label: attempt.examVersion.label }))} />
  </div>;
}
