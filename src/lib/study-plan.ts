import {z} from "zod";
export const skills=["READING","LISTENING","WRITING","SPEAKING"] as const;
export const skillLabels={READING:"Reading",LISTENING:"Listening",WRITING:"Writing",SPEAKING:"Speaking"};
export function goalScale(slug:string){return slug==="toefl-ibt"?{min:1,max:6,step:.5,label:"Banda de práctica TOEFL · 1–6",version:"verbo-toefl-practice-v1"}:slug==="det"?{min:0,max:100,step:1,label:"Índice de práctica DET · 0–100",version:"verbo-det-practice-v1"}:null;}
export const studyPlanZ=z.object({enrollmentId:z.string().min(1),targetScore:z.number().finite().nullable(),targetDate:z.union([z.literal(""),z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>{const date=new Date(v+"T12:00:00Z");return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===v;},"La fecha no existe.")]),weeklyGoal:z.number().int().min(1).max(7),focusSkills:z.array(z.enum(skills)).max(2).refine(v=>new Set(v).size===v.length)}).strict();
export function validGoalScore(slug:string,score:number|null){const scale=goalScale(slug);return score===null||!!scale&&score>=scale.min&&score<=scale.max&&Math.abs(score/scale.step-Math.round(score/scale.step))<1e-8;}
// Calendar-week boundaries in Mexico City, independent of the host's timezone.
export function mexicoWeek(now=new Date()) {
  const formatter=new Intl.DateTimeFormat("en-CA",{timeZone:"America/Mexico_City",year:"numeric",month:"2-digit",day:"2-digit"});
  const parts=formatter.formatToParts(now);const value=(type:string)=>Number(parts.find(p=>p.type===type)!.value);
  const day=new Date(Date.UTC(value("year"),value("month")-1,value("day")));
  day.setUTCDate(day.getUTCDate()-(day.getUTCDay()+6)%7);
  const offset=new Intl.DateTimeFormat("en",{timeZone:"America/Mexico_City",timeZoneName:"longOffset"}).formatToParts(new Date(day.getTime()+12*3600000)).find(p=>p.type==="timeZoneName")!.value;
  const match=/GMT([+-])(\d{2}):(\d{2})/.exec(offset);const minutes=match?(match[1]==="-"?-1:1)*(Number(match[2])*60+Number(match[3])):0;
  const start=new Date(day.getTime()-minutes*60000),end=new Date(start.getTime()+7*86400000);
  return {start,end};
}
export const focusAdvice={
  READING:"Dedica 15 minutos a localizar la idea central y la evidencia que respalda cada respuesta. Revisa después tus distractores.",
  LISTENING:"Practica tomar notas breves de la idea principal, la intención y los detalles. Revisa tus respuestas al terminar el intento.",
  WRITING:"Prepara una idea, un ejemplo y un cierre. Reserva tiempo para revisar claridad, conexión entre ideas y precisión.",
  SPEAKING:"Usa una estructura breve: respuesta, razón y ejemplo. Revisa con tu profesor tus grabaciones y la rúbrica.",
};
