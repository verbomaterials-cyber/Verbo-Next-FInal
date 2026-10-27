import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasExamAccess } from "@/lib/student/actions";
import { EquipmentCheck } from "./equipment-check";
import { deliveryMetadata } from "@/lib/toefl-delivery";
import { DET_FORMAT, detMetadata } from "@/lib/det-format";

export default async function PreparationPage({ params }: { params: Promise<{ versionId: string }> }) {
  const { versionId } = await params;
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "STUDENT") redirect("/login");
  const version = await prisma.examVersion.findUnique({ where: { id: versionId },
    include: { examType: { select: { slug: true, name: true } }, _count: { select: { questions: true } }, questions: { take: 1, select: { promptContent: true } } } });
  if (!version || !version.isPublished || !version._count.questions) notFound();
  const enrollment = await prisma.enrollment.findUnique({ where: {
    studentId_examTypeId: { studentId: session.user.id, examTypeId: version.examTypeId },
  } });
  if (!enrollment || enrollment.isBlocked || !enrollment.unlockedVersions.includes(version.id)) notFound();
  if (!(await hasExamAccess(enrollment.id))) redirect(`/alumno/examen/${version.examType.slug}`);
  return <EquipmentCheck versionId={version.id} label={version.label} examName={version.examType.name}
    questionCount={detMetadata(version.questions[0]?.promptContent) ? DET_FORMAT.practiceScreens : deliveryMetadata(version.questions[0]?.promptContent) ? 120 : version._count.questions} det={!!detMetadata(version.questions[0]?.promptContent)} />;
}
