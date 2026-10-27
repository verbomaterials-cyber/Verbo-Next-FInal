import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ExamMark } from "@/components/brand";
import { Icon } from "@/components/icons";
import { AttemptActivity } from "@/components/attempt-activity";
import { portalDate, practiceScore } from "@/lib/portal";

export default async function StudentHome() {
  const session = await getServerSession(authOptions), studentId = session!.user.id;
  const [student, enrollments, counts, recent, active, latestResult] = await Promise.all([
    prisma.student.findUniqueOrThrow({ where: { id: studentId }, select: { fullName: true } }),
    prisma.enrollment.findMany({ where: { studentId }, include: { examType: { select: { id: true, name: true, slug: true, totalDurationMinutes: true } } }, orderBy: { createdAt: "asc" } }),
    prisma.attempt.groupBy({ by: ["status"], where: { studentId }, _count: { _all: true } }),
    prisma.attempt.findMany({ where: { studentId }, orderBy: [{ startedAt: "desc" }, { id: "desc" }], take: 4, include: { examVersion: { select: { label: true, examType: { select: { name: true, slug: true } } } } } }),
    prisma.attempt.findFirst({ where: { studentId, status: "IN_PROGRESS", examVersion: { examType: { enrollments: { some: { studentId, isBlocked: false } } } } }, orderBy: { startedAt: "desc" }, select: { id: true, examVersion: { select: { label: true, examType: { select: { name: true } } } } } }),
    prisma.attempt.findFirst({ where: { studentId, status: "COMPLETED" }, orderBy: { completedAt: "desc" }, select: { id: true, overallScore: true, examVersion: { select: { label: true, examType: { select: { name: true } } } } } }),
  ]);
  const completed = counts.find(c => c.status === "COMPLETED")?._count._all ?? 0;
  const pending = counts.find(c => c.status === "PENDING_REVIEW")?._count._all ?? 0;
  const available = enrollments.length;
  const first = enrollments.find(e => !e.isBlocked);
  return <>
    <div className="page-heading"><div><h1>Hola, {student.fullName.trim().split(/\s+/)[0]}<span className="brand-period">.</span></h1><p>Un espacio para practicar, entender tus avances y seguir construyendo confianza.</p></div><time className="quiet-date" dateTime={new Date().toISOString()}>{portalDate(new Date(), true)}</time></div>
    <div className="dashboard-welcome"><section className="next-action-panel"><h2>{active ? "Tu práctica te está esperando." : completed ? "Lo que sigue se construye practicando." : "Todo empieza con un primer intento."}</h2><p>{active ? `Tienes ${active.examVersion.label} en curso. Al volver se conserva el tiempo del servidor, sin reiniciar el reloj.` : pending ? "Hay respuestas esperando revisión. Mientras tanto, puedes explorar los simuladores que tu asesor tiene disponibles para ti." : "Elige tu examen, prepara tu espacio y dedica este momento a tu siguiente meta. Tu asesor te acompaña en el proceso."}</p><Link className="next-button" href={active ? `/alumno/intento/${active.id}` : first ? `/alumno/examen/${first.examType.slug}` : "/alumno/ayuda"}>{active ? "Retomar mi intento" : first ? "Ir a mi práctica" : "Conocer los primeros pasos"}<Icon name={active ? "play" : "arrow"} size={17} /></Link></section><dl className="dashboard-summary"><div><dt><Icon name="book" size={18} />Exámenes asignados</dt><dd>{available}</dd></div><div><dt><Icon name="check" size={18} />Intentos finalizados</dt><dd>{completed}</dd></div><div><dt><Icon name="clock" size={18} />En revisión</dt><dd>{pending}</dd></div></dl></div>
    {latestResult && practiceScore(latestResult.overallScore, "COMPLETED") && <section className="student-milestone"><span><Icon name="chart" size={28} /></span><div><h2>Tu avance merece hacerse visible.</h2><p>{latestResult.examVersion.examType.name} · {practiceScore(latestResult.overallScore, "COMPLETED")!.value} · {practiceScore(latestResult.overallScore, "COMPLETED")!.label}. Tu constancia de simulación está lista.</p></div><Link className="text-link" href={`/alumno/resultado/${latestResult.id}#constancia`}>Ver mi constancia<Icon name="arrow" size={17} /></Link></section>}
    <section id="examenes" className="scroll-mt-6"><div className="section-heading"><h2>Tu próxima práctica</h2><p>Tu asesor administra los accesos e intentos.</p></div>
      {enrollments.length ? <ul className="exam-grid">{enrollments.map(enrollment => {
        const exam = enrollment.examType, remaining = Math.max(0, enrollment.attemptsAllowed - enrollment.attemptsUsed), blocked = enrollment.isBlocked;
        const description = exam.slug === "det" ? "Una tarea a la vez. Practica lectura, escucha, escritura y conversación con el ritmo del DET." : exam.slug === "toefl-ibt" ? "Entrena las cuatro habilidades con tareas académicas, módulos y conversaciones del formato 2026." : "Conoce las versiones y tareas que tu asesor preparó para tu certificación.";
        const body = <><div className="exam-card-top"><ExamMark slug={exam.slug} name={exam.name} /><span className={`status-pill ${blocked ? "status-pill-blocked" : !remaining ? "status-pill-pending" : ""}`}>{blocked ? "Acceso bloqueado" : remaining ? "Listo para practicar" : "Sin intentos disponibles"}</span></div><h3>{exam.name}</h3><p>{description}</p><div className="exam-card-info"><span><Icon name="clock" size={15} />Hasta {exam.totalDurationMinutes} min</span><span><Icon name="play" size={14} />{remaining} intentos disponibles</span></div><span className="exam-card-link">{blocked ? "Contacta a tu asesor para continuar" : "Explorar simuladores"}{!blocked && <Icon name="arrow" size={18} />}</span></>;
        return <li key={enrollment.id}>{blocked ? <div className="exam-card">{body}</div> : <Link href={`/alumno/examen/${exam.slug}`} className="exam-card">{body}</Link>}</li>;
      })}</ul> : <div className="empty-state"><Icon name="book" size={29} /><h3>Tu preparación está por comenzar.</h3><p>Cuando tu asesor te asigne un examen, aparecerá aquí con sus simuladores disponibles.</p><Link className="text-link" href="/alumno/ayuda">Ver cómo funciona<Icon name="arrow" size={16} /></Link></div>}
    </section>
    <section><div className="section-heading"><h2>Tu actividad reciente</h2><Link href="/alumno/resultados" className="text-link">Ver historial<Icon name="arrow" size={16} /></Link></div>{recent.length ? <AttemptActivity attempts={recent} /> : <div className="empty-state"><Icon name="chart" size={28} /><h3>Aquí empieza tu historia.</h3><p>Tu primer intento aparecerá aquí. Después podrás retomar prácticas y consultar resultados sin perder de vista tu recorrido.</p></div>}</section>
    <div className="mt-7 flex flex-wrap items-center justify-between gap-4 text-xs leading-6 text-ink-muted"><p>Los resultados orientan tu práctica. Las respuestas abiertas pasan por revisión.</p><Link className="text-link" href="/alumno/ayuda"><Icon name="help" size={16} />Guía rápida</Link></div>
  </>;
}
