import { Prisma, type PrismaClient } from "@prisma/client";
import { detAssessmentZ, DET_RUBRIC_VERSION, detDelivered, detMetadata, detPoints } from "./det-format";
type Loaded = {
  id: string; runtimeState: Prisma.JsonValue | null; completedAt: Date | null; student: { fullName: string };
  responses: { id: string; questionId: string; answerContent: Prisma.JsonValue; reviewAssessment: Prisma.JsonValue | null }[];
  examVersion: { label: string; questions: { id: string; promptContent: Prisma.JsonValue; correctAnswer: Prisma.JsonValue | null; questionType: { name: string; responseType: string } }[] };
};
export async function gradeDetAttempt(db: PrismaClient | Prisma.TransactionClient, attempt: Loaded) {
  const selections=(attempt.runtimeState as {detSelections?:Record<string,string>} | null)?.detSelections ?? {};
  const responses=new Map(attempt.responses.map(r=>[r.questionId,r]));
  const raw=Object.fromEntries(["Reading","Listening","Writing","Speaking"].map(name=>[name,{earned:0,possible:0,pending:0}]));
  const updates:{id:string;isCorrect:boolean|null;assessment?:Prisma.InputJsonValue}[]=[];
  for(const q of attempt.examVersion.questions) {
    const meta=detMetadata(q.promptContent); if(!meta || !detDelivered(meta,q.id,selections))continue;
    const r=responses.get(q.id),answer=(r?.answerContent ?? {}) as Record<string,unknown>, section=raw[meta.skill];
    if(["FREE_TEXT","AUDIO_RECORDING"].includes(q.questionType.responseType)) {
      section.possible+=5;
      const assessment=detAssessmentZ.safeParse(r?.reviewAssessment);
      const empty=q.questionType.responseType==="FREE_TEXT" ? typeof answer.text!=="string" || !answer.text.trim() : answer.recorded!==true;
      if(assessment.success && assessment.data.task===q.questionType.name)section.earned+=assessment.data.score;
      else if(!empty)section.pending++;
      else if(r)updates.push({id:r.id,isCorrect:false,assessment:{version:DET_RUBRIC_VERSION,task:q.questionType.name,score:0,source:"missing"}});
    } else {
      const points=detPoints(q.promptContent as Record<string,unknown>,q.correctAnswer as Record<string,unknown>|null,answer);
      if(meta.task==="listen-complete") {
        const assessment=detAssessmentZ.safeParse(r?.reviewAssessment);
        const nonempty=Array.isArray(answer.answers)&&answer.answers.some(a=>typeof a==="string"&&a.trim());
        section.possible+=points.possible;
        if(assessment.success && assessment.data.task===q.questionType.name) {
          section.earned+=points.possible*assessment.data.score/5;
          if(r)updates.push({id:r.id,isCorrect:assessment.data.score===5});
        } else if(nonempty&&points.earned<points.possible) {
          // Unrecognised paraphrases require a person, rather than a false automatic rejection.
          section.pending++;if(r)updates.push({id:r.id,isCorrect:null});
        } else {section.earned+=points.earned;if(r)updates.push({id:r.id,isCorrect:points.earned===points.possible});}
        continue;
      }
      section.earned+=points.earned;section.possible+=points.possible;
      if(r)updates.push({id:r.id,isCorrect:points.earned===points.possible});
    }
  }
  const pendingCount=Object.values(raw).reduce((n,s)=>n+s.pending,0);
  const subscores=Object.fromEntries(Object.entries(raw).filter(([,s])=>s.possible>0 && !s.pending).map(([name,s])=>[name,Math.round(100*s.earned/s.possible)]));
  const value=Object.keys(subscores).length===4?Math.round(Object.values(subscores).reduce((a,b)=>a+b,0)/4):null;
  const status=pendingCount?"PENDING_REVIEW" as const:"COMPLETED" as const;
  const persist=async(tx:Prisma.TransactionClient)=>{
    for(const u of updates)await tx.response.update({where:{id:u.id},data:{isCorrect:u.isCorrect,...(u.assessment?{reviewAssessment:u.assessment}:{})}});
    await tx.attempt.update({where:{id:attempt.id},data:{status,completedAt:attempt.completedAt??new Date(),subscores,overallScore:{value,pending:!!pendingCount,raw,calibrated:false,scoringVersion:"verbo-det-practice-v1",unit:"percent",selections}}});
    if(pendingCount) {
      if(!await tx.notification.findFirst({where:{attemptId:attempt.id,type:"ATTEMPT_PENDING_REVIEW"}})) await tx.notification.create({data:{type:"ATTEMPT_PENDING_REVIEW",attemptId:attempt.id,message:`${attempt.student.fullName} completó ${attempt.examVersion.label}: ${pendingCount} respuestas DET por revisar.`,payload:{pendingCount}}});
    } else await tx.notification.updateMany({where:{attemptId:attempt.id,isRead:false},data:{isRead:true}});
  };
  if("$transaction" in db)await db.$transaction(persist,{timeout:20000});else await persist(db);
  return{status,pendingCount};
}
