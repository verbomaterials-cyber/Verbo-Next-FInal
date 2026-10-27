import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Icon } from "@/components/icons";
import { ExamMark } from "@/components/brand";
import { portalDate } from "@/lib/portal";
export default async function AdminHome() {
  const [exams,students,accesses,pending,finished,recent] = await Promise.all([
    prisma.examType.findMany({orderBy:{createdAt:"asc"},include:{_count:{select:{enrollments:true,examVersions:true}}}}),
    prisma.student.count(),prisma.enrollment.count({where:{isBlocked:false,student:{isActive:true}}}),
    prisma.attempt.count({where:{status:"PENDING_REVIEW"}}),prisma.attempt.count({where:{status:"COMPLETED"}}),
    prisma.attempt.findMany({where:{status:"PENDING_REVIEW"},take:4,orderBy:{completedAt:"asc"},include:{student:{select:{fullName:true}},examVersion:{select:{label:true,examType:{select:{name:true}}}}}}),
  ]);
  return <div className="rise-in"><section className="admin-hero"><div><span className="site-eyebrow">VERBO NEXT · CENTRO DE CONTROL</span><h1>Más claridad.<br />Mejor acompañamiento.</h1><p>Personas, accesos y resultados: todo lo que necesitas para que cada alumno tenga un siguiente paso.</p></div><div className="admin-hero-actions"><Link href="/admin/accesos" className="next-button next-button-lime">Gestionar accesos<Icon name="arrow" size={17} /></Link><Link className="text-link" href="/admin/alumnos">Agregar o editar alumnos<Icon name="users" size={16} /></Link></div></section>
    <div className="admin-stats">{[
      {title:"Alumnos",value:students,help:"Perfiles en la plataforma",href:"/admin/alumnos",icon:"users" as const},
      {title:"Accesos activos",value:accesses,help:"Permisos habilitados",href:"/admin/accesos",icon:"lock" as const},
      {title:"Por revisar",value:pending,help:"Intentos que necesitan tu mirada",href:"/admin/metricas",icon:"clock" as const},
      {title:"Evaluaciones listas",value:finished,help:"Resultados completos",href:"/admin/metricas",icon:"check" as const},
    ].map(s=><Link href={s.href} className="admin-stat" key={s.title}><span><Icon name={s.icon} size={17} />{s.title}</span><strong>{s.value}</strong><small>{s.help}</small></Link>)}</div>
    <div className="admin-columns"><section className="admin-panel" id="examenes"><div className="admin-panel-title"><h2>Tus exámenes</h2><Link href="/admin/examenes/nuevo" className="text-link">+ Crear examen</Link></div>{exams.length?exams.map(e=><Link className="admin-exam" href={`/admin/examenes/${e.slug}/estructura`} key={e.id}><ExamMark slug={e.slug} name={e.name} /><div><h3>{e.name}</h3><p>{e._count.examVersions} versiones · {e._count.enrollments} alumnos · {e.totalDurationMinutes} min</p></div><Icon name="arrow" size={19} /></Link>):<p className="text-sm text-ink-muted">Crea tu primer examen para comenzar.</p>}<div className="admin-notice">Publicar una versión la hace elegible. Después, en <Link className="font-semibold underline" href="/admin/accesos">Accesos</Link>, decides quién la puede utilizar.</div></section>
    <section className="admin-panel"><div className="admin-panel-title"><h2>Tu mesa de trabajo</h2><Icon name="target" size={20} /></div>{[
      {href:"/admin/alumnos",icon:"users" as const,title:"Alumnos y perfiles",text:"Perfiles, contraseñas y suspensión de cuentas"},
      {href:"/admin/profesores",icon:"user" as const,title:"Equipo docente",text:"Cuentas de profesor y asignación de alumnos"},
      {href:"/admin/accesos",icon:"lock" as const,title:"Permisos por examen",text:"Asignaciones, códigos, versiones e intentos"},
      {href:"/admin/metricas",icon:"chart" as const,title:"Revisión y seguimiento",text:"Respuestas, rúbricas y avances"},
      {href:"/admin/correos",icon:"mail" as const,title:"Correos y avisos",text:"Estado de envíos y reintentos"},
    ].map(s=><Link className="admin-shortcut" href={s.href} key={s.href}><span><Icon name={s.icon} /></span><div><strong>{s.title}</strong><p>{s.text}</p></div><Icon name="chevron" size={15} /></Link>)}</section></div>
    <section className="admin-panel mt-6"><div className="admin-panel-title"><h2>La siguiente revisión</h2><Link href="/admin/metricas" className="text-link">Ver todas<Icon name="arrow" size={16} /></Link></div>{recent.length?recent.map(a=><Link key={a.id} href={`/admin/revision/${a.id}`} className="admin-shortcut"><span><Icon name="user" /></span><div><strong>{a.student.fullName}</strong><p>{a.examVersion.examType.name} · {a.examVersion.label}{a.completedAt?` · ${portalDate(a.completedAt)}`:""}</p></div><Icon name="arrow" size={18} /></Link>):<p className="text-sm leading-7 text-ink-muted">Todo al día. Cuando un alumno envíe respuestas para evaluar, aparecerán aquí.</p>}</section>
  </div>;
}

