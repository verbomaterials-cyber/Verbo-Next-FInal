import {notFound,redirect} from "next/navigation";
import Link from "next/link";
import { getAppSession } from "@/lib/session";
import {prisma} from "@/lib/prisma";
import {staffStudentScope} from "@/lib/teacher/scope";
import {portalDate,practiceScore} from "@/lib/portal";
import {loadStudyPlans} from "@/lib/student/plan-data";
import {StudyPlanCard} from "@/components/study-plan-card";
import {Badge} from "@/components/ui";
export const metadata={title:"Plan y avance del alumno"};
export default async function StudentTeachingPage({params}:{params:Promise<{studentId:string}>}){
  const session=await getAppSession();if(!session||!["ADMIN","TEACHER"].includes(session.user.role))redirect("/login");
  const {studentId}=await params;const student=await prisma.student.findFirst({where:{id:studentId,...staffStudentScope(session.user)},select:{id:true,fullName:true,email:true,isActive:true}});if(!student)notFound();
  const teacher=session.user.role==="TEACHER",reviewBase=teacher?"/profesor/revision":"/admin/revision";
  const [plans,attempts]=await Promise.all([loadStudyPlans(student.id),prisma.attempt.findMany({where:{studentId:student.id},take:30,orderBy:{startedAt:"desc"},select:{id:true,status:true,startedAt:true,completedAt:true,overallScore:true,examVersion:{select:{label:true,examType:{select:{name:true}}}}}})]);
  return <><Link href={teacher?"/profesor/alumnos":"/admin/alumnos"} className="text-link">← Volver a alumnos</Link><div className="page-heading mt-6"><div><h1>{student.fullName}</h1><p>{student.email}</p></div><Badge tone={student.isActive?"success":"warning"}>{student.isActive?"Cuenta activa":"Cuenta suspendida"}</Badge></div><div className="study-plan-list">{plans.map(plan=><StudyPlanCard key={plan.id} plan={plan} staff reviewBase={reviewBase}/>)}{!plans.length&&<div className="empty-state"><h2>Aún no tiene exámenes asignados.</h2><p>La administración puede habilitar un examen para comenzar su plan.</p></div>}</div><section className="admin-panel mt-7"><h2>Intentos recientes</h2><p className="mt-2 text-xs text-ink-muted">Últimos 30 intentos. Los resultados pendientes no se muestran como puntajes definitivos.</p><div className="mt-5 overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm"><thead className="border-b border-line text-xs text-ink-muted"><tr><th className="py-3">Simulación</th><th>Fecha</th><th>Estado</th><th>Resultado de práctica</th></tr></thead><tbody>{attempts.map(a=>{const score=practiceScore(a.overallScore,a.status);return <tr key={a.id} className="border-b border-line"><td className="py-4">{a.status==="IN_PROGRESS"?<span>{a.examVersion.examType.name} · {a.examVersion.label}</span>:<Link className="font-medium text-brand" href={`${reviewBase}/${a.id}`}>{a.examVersion.examType.name} · {a.examVersion.label}</Link>}</td><td className="text-xs text-ink-muted">{portalDate(a.completedAt??a.startedAt,true)}</td><td className="text-xs">{a.status==="PENDING_REVIEW"?"Por revisar":a.status==="COMPLETED"?"Evaluado":"En curso"}</td><td><strong>{score?.value??"—"}</strong>{score&&<small className="mt-1 block text-ink-muted">{score.label}</small>}</td></tr>;})}</tbody></table>{!attempts.length&&<p className="py-8 text-sm text-ink-muted">Todavía no ha comenzado un intento.</p>}</div></section></>;
}
