import { notFound, redirect } from "next/navigation";
import { getAppSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { AccessCodeForm } from "./access-code-form";
import { VersionCard } from "./version-card";
import { hasExamAccess } from "@/lib/student/actions";
import { deliveryMetadata } from "@/lib/toefl-delivery";
import Link from "next/link";
import { DET_FORMAT, detMetadata } from "@/lib/det-format";
import { ExamMark } from "@/components/brand";
import { Icon } from "@/components/icons";

export default async function ExamSelectionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const session = await getAppSession();
  if (!session || session.user.role !== "STUDENT") redirect("/login");

  const examType = await prisma.examType.findUnique({
    where: { slug },
    include: {
      examVersions: {
        where: { isPublished: true },
        orderBy: { label: "asc" },
        include: { _count: { select: { questions: true } }, questions: { take: 1, select: { promptContent: true } } },
      },
    },
  });
  if (!examType) notFound();

  const enrollment = await prisma.enrollment.findUnique({
    where: {
      studentId_examTypeId: {
        studentId: session!.user.id,
        examTypeId: examType.id,
      },
    },
  });
  // Nunca mostrar exámenes sin enrollment o bloqueados
  if (!enrollment || enrollment.isBlocked) redirect("/alumno");

  const hasAccess = await hasExamAccess(enrollment.id);

  if (!hasAccess) {
    return (
      <div className="profile-surface mx-auto mt-5 max-w-md">
        <ExamMark slug={slug} name={examType.name} large />
        <h1 className="mt-6 text-2xl font-semibold tracking-tight">Tu práctica empieza aquí.</h1>
        <p className="mt-3 text-sm leading-7 text-ink-muted">
          Ingresa el código que te entregó tu asesor para abrir tus simuladores de {examType.name}.
        </p>
        <div className="mt-6">
          <AccessCodeForm slug={slug} />
        </div>
        <Link href="/alumno/ayuda" className="text-link mt-6">¿Necesitas ayuda con tu acceso?<Icon name="arrow" size={16} /></Link>
      </div>
    );
  }

  const attemptsLeft = Math.max(0,enrollment.attemptsAllowed - enrollment.attemptsUsed);

  const inProgress = await prisma.attempt.findMany({
    where: {
      studentId: session!.user.id,
      status: "IN_PROGRESS",
      examVersion: { examTypeId: examType.id },
    },
    select: { examVersionId: true },
  });
  const inProgressSet = new Set(inProgress.map((a) => a.examVersionId));
  const currentDet=examType.slug==="det"&&examType.examVersions.some(v=>detMetadata(v.questions[0]?.promptContent));
  const visibleVersions=examType.examVersions.filter(version=>!currentDet||detMetadata(version.questions[0]?.promptContent)||inProgressSet.has(version.id));

  return (
    <div className="rise-in">
      <Link href="/alumno#examenes" className="text-link mb-7">← Mis exámenes</Link>
      <div className="catalog-header"><ExamMark slug={slug} name={examType.name} large /><div><h1>{examType.name}</h1><p>Encuentra tu punto de partida con el diagnóstico y continúa con tus simuladores.</p></div></div>
      <div className="catalog-facts"><span><strong>{attemptsLeft}</strong> intentos disponibles</span><span>{currentDet?"72 pantallas · 13 grupos de tareas":"Preparación y revisión por habilidades"}</span><span>Formato de práctica 2026</span></div>
      <div className="section-heading"><h2>Elige tu siguiente intento</h2>{examType.slug === "toefl-ibt" ? <Link href="/alumno/progreso/toefl-ibt" className="text-link">Ver mi progreso<Icon name="chart" size={17}/></Link> : <Link href={`/alumno/resultados?examen=${slug}`} className="text-link">Mis resultados<Icon name="chart" size={17}/></Link>}</div>
      <ul className="exam-grid">
      {visibleVersions.map((version) => {
          const unlocked = enrollment.unlockedVersions.includes(version.id);
          return (
            <li key={version.id}>
              <VersionCard
                versionId={version.id}
                label={version.label}
                hasFeedback={version.hasFeedback}
                questionCount={detMetadata(version.questions[0]?.promptContent) ? DET_FORMAT.practiceScreens : deliveryMetadata(version.questions[0]?.promptContent) ? 120 : version._count.questions}
                detFull={!!detMetadata(version.questions[0]?.promptContent)}
                fullLength={!!deliveryMetadata(version.questions[0]?.promptContent)}
                unlocked={unlocked}
                resumable={inProgressSet.has(version.id)}
                attemptsLeft={attemptsLeft}
                requiresSetup={examType.slug === "toefl-ibt" || !!detMetadata(version.questions[0]?.promptContent)}
              />
            </li>
          );
        })}
      </ul>

      {!visibleVersions.length&&<div className="empty-state"><h2>Tus simuladores están en preparación.</h2><p>Tu asesor te indicará cuándo está disponible la siguiente versión.</p></div>}
      <p className="mt-8 text-xs text-ink-muted">Los resultados son de práctica y requieren revisión de las respuestas abiertas. Verbo no está afiliado al organismo certificador.</p>
    </div>
  );
}
