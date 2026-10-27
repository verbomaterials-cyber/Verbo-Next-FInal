import Link from "next/link";
import { getServerSession } from "next-auth";
import { Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AttemptActivity } from "@/components/attempt-activity";
import { Icon } from "@/components/icons";
export const metadata = { title: "Mis resultados" };
export default async function ResultsPage({ searchParams }: { searchParams: Promise<{ examen?: string; estado?: string; pagina?: string }> }) {
  const session = await getServerSession(authOptions), query = await searchParams;
  const exam = query.examen ?? "", status = ["COMPLETED", "PENDING_REVIEW", "IN_PROGRESS"].includes(query.estado ?? "") ? query.estado! as "COMPLETED" | "PENDING_REVIEW" | "IN_PROGRESS" : "";
  const requestedPage = Number(query.pagina), page = Number.isInteger(requestedPage) && requestedPage > 0 ? Math.min(requestedPage, 10000) : 1;
  const where: Prisma.AttemptWhereInput = { studentId: session!.user.id, ...(exam ? { examVersion: { examType: { slug: exam } } } : {}), ...(status ? { status } : {}) };
  const [attempts, count, enrollments] = await Promise.all([
    prisma.attempt.findMany({ where, orderBy: [{ startedAt: "desc" }, { id: "desc" }], skip: (page - 1) * 12, take: 12, include: { examVersion: { select: { label: true, examType: { select: { name: true, slug: true } } } } } }),
    prisma.attempt.count({ where }), prisma.enrollment.findMany({ where: { studentId: session!.user.id }, select: { examType: { select: { name: true, slug: true } } } }),
  ]);
  const paginationHref = (n: number) => `/alumno/resultados?${new URLSearchParams({ examen: exam, estado: status, pagina: String(n) })}`;
  return <><div className="page-heading"><div><h1>Cada intento cuenta.</h1><p>Retoma tu práctica, consulta resultados y sigue las revisiones de tu asesor. Cada examen conserva su propia escala de práctica.</p></div><Link className="text-link" href="/alumno#examenes">Ir a mis exámenes<Icon name="arrow" size={17} /></Link></div>
    <form className="filter-bar" action="/alumno/resultados"><label htmlFor="result-exam">Examen<select id="result-exam" name="examen" defaultValue={exam}><option value="">Todos los exámenes</option>{enrollments.map(e => <option key={e.examType.slug} value={e.examType.slug}>{e.examType.name}</option>)}</select></label><label htmlFor="result-status">Estado<select id="result-status" name="estado" defaultValue={status}><option value="">Todos los estados</option><option value="IN_PROGRESS">En curso</option><option value="PENDING_REVIEW">En revisión</option><option value="COMPLETED">Finalizados</option></select></label><button type="submit" className="next-button"><Icon name="filter" size={16} />Aplicar filtros</button>{(exam || status) && <Link className="text-link self-center pt-5" href="/alumno/resultados">Limpiar</Link>}</form>
    <p className="mb-4 text-xs text-ink-muted">{count} {count === 1 ? "intento" : "intentos"}{count > 0 ? ` · Página ${page} de ${Math.ceil(count / 12)}` : ""}</p>
    {attempts.length ? <AttemptActivity attempts={attempts} /> : <div className="empty-state"><Icon name="chart" size={30} /><h2>{exam || status || page > 1 ? "No hay intentos en esta vista." : "Aquí verás tu recorrido."}</h2><p>{exam || status || page > 1 ? "Prueba con otro examen o estado, o vuelve al historial completo." : "Cuando comiences una práctica, podrás volver aquí para retomarla o revisar sus resultados."}</p><Link className="text-link" href={exam || status || page > 1 ? "/alumno/resultados" : "/alumno#examenes"}>{exam || status || page > 1 ? "Ver todo el historial" : "Explorar mis exámenes"}<Icon name="arrow" size={16} /></Link></div>}
    {count > 12 && <nav aria-label="Páginas del historial" className="mt-7 flex justify-between gap-5">{page > 1 ? <Link href={paginationHref(page - 1)} className="text-link">← Anterior</Link> : <span />}{page * 12 < count && <Link href={paginationHref(page + 1)} className="text-link">Siguiente<Icon name="arrow" size={16} /></Link>}</nav>}
  </>;
}
