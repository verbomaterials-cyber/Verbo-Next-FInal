import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ToeflProgressReport } from "@/components/toefl-progress-report";
export default async function StudentProgressPage({ params }: { params: Promise<{ studentId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") redirect("/login");
  const { studentId } = await params;
  const student = await prisma.student.findUnique({ where: { id: studentId }, select: { fullName: true, email: true,
    attempts: { where: { examVersion: { examType: { slug: "toefl-ibt" } }, status: { in: ["COMPLETED", "PENDING_REVIEW"] } },
      select: { id: true, status: true, startedAt: true, completedAt: true, overallScore: true, examVersion: { select: { label: true } } }, orderBy: { completedAt: "asc" } } } });
  if (!student) notFound();
  return <div className="rise-in mx-auto max-w-5xl"><Link href="/admin/alumnos" className="text-sm text-ink-muted hover:text-brand">← Alumnos</Link>
    <p className="mt-7 text-xs font-semibold tracking-[.15em] text-brand">PROGRESO TOEFL</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">{student.fullName}</h1>
    <p className="mt-2 text-sm text-ink-muted">{student.email}</p><ToeflProgressReport canOpenStudentResults={false} attempts={student.attempts.map((attempt) => ({ ...attempt, label: attempt.examVersion.label }))} />
  </div>;
}
