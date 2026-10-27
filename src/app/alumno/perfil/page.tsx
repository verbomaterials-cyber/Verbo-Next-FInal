import Link from "next/link";
import { getAppSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { portalDate } from "@/lib/portal";
import { ProfileForm } from "./profile-form";
import { Icon } from "@/components/icons";
export const metadata = { title: "Mi perfil" };
export default async function ProfilePage() {
  const session = await getAppSession();
  const student = await prisma.student.findUniqueOrThrow({ where: { id: session!.user.id }, include: { enrollments: { include: { examType: { select: { name: true, slug: true } } }, orderBy: { createdAt: "asc" } } } });
  const initials = student.fullName.trim().split(/\s+/).slice(0, 2).map(s => s[0]).join("");
  return <><div className="page-heading"><div><h1>Tu espacio, a tu nombre.</h1><p>Consulta tus datos y los accesos que acompañan tu preparación.</p></div></div><div className="profile-grid">
    <section className="profile-surface"><span className="avatar profile-avatar" aria-hidden="true">{initials}</span><h2>Datos personales</h2><ProfileForm fullName={student.fullName} email={student.email} /></section>
    <aside className="profile-aside"><section className="profile-surface"><h2>Mis accesos</h2>{student.enrollments.length ? student.enrollments.map(e => <div className="profile-access" key={e.id}><h3>{e.examType.name}<span className={`status-pill ${e.isBlocked ? "status-pill-blocked" : ""}`}>{e.isBlocked ? "Bloqueado" : "Asignado"}</span></h3><p>{Math.max(0, e.attemptsAllowed - e.attemptsUsed)} intentos disponibles de {e.attemptsAllowed}.</p>{!e.isBlocked && <Link className="text-link" href={`/alumno/examen/${e.examType.slug}`}>Ver simuladores<Icon name="arrow" size={16} /></Link>}</div>) : <p className="text-sm leading-7 text-ink-muted">Tu asesor podrá asignarte un examen cuando comience tu preparación.</p>}</section><p className="px-1 text-xs leading-7 text-ink-muted">Miembro desde el {portalDate(student.createdAt, true)}.<br />Tus respuestas y grabaciones solo están disponibles para ti y el equipo autorizado de Verbo.</p></aside>
  </div></>;
}
