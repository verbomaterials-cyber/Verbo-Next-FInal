import {getServerSession} from "next-auth";
import {redirect} from "next/navigation";
import Link from "next/link";
import {authOptions} from "@/lib/auth";
import {loadStudyPlans} from "@/lib/student/plan-data";
import {StudyPlanCard} from "@/components/study-plan-card";
export const metadata={title:"Mi plan"};
export default async function PlanPage(){const session=await getServerSession(authOptions);if(!session||session.user.role!=="STUDENT")redirect("/login");const plans=await loadStudyPlans(session.user.id);return <><div className="page-heading"><div><h1>Tu meta, con un camino.</h1><p>Define tu objetivo, elige tus prioridades y haz de cada semana un paso concreto.</p></div></div><div className="study-plan-list">{plans.length?plans.map(p=><StudyPlanCard key={p.id} plan={p}/>):<div className="empty-state"><h2>Tu plan comienza con un examen asignado.</h2><p>Cuando tu asesor habilite tu acceso podrás definir tu meta y tu objetivo semanal.</p><Link href="/alumno/ayuda" className="text-link">Contactar a mi asesor</Link></div>}</div></>;}
