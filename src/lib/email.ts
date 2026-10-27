import type { Prisma } from "@prisma/client";
import { after } from "next/server";
import { createPrivateKey, sign } from "node:crypto";
import { prisma } from "@/lib/prisma";
export function emailConfiguration() {
  const bridge=!!(process.env.NEXT_EMAIL_BRIDGE_URL && process.env.NEXT_EMAIL_PRIVATE_KEY);
  const direct=!!(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL);
  return { configured:bridge||direct, transport:bridge?"Academy · Resend":direct?"Resend":"Sin configurar" };
}
export async function queueEmail(tx:Prisma.TransactionClient, data:{ eventKey:string; recipient:string; subject:string; text:string }) {
  return tx.emailDelivery.upsert({where:{eventKey:data.eventKey},create:data,update:{},select:{id:true}});
}
export function scheduleEmails() {
  after(async()=>{try{await flushEmails();}catch{console.error("No se pudo procesar la cola de correos NEXT.");}});
}
export async function flushEmails(limit=8) {
  if(!emailConfiguration().configured)return {sent:0,failed:0,configured:false};
  let sent=0,failed=0;
  for(let i=0;i<limit;i++) {
    const delivery=await prisma.$transaction(async tx=>{
      const rows=await tx.$queryRaw<{id:string}[]>`SELECT "id" FROM "EmailDelivery" WHERE ("status"='PENDING' OR ("status"='SENDING' AND "lockedAt" < NOW()-INTERVAL '2 minutes')) ORDER BY "createdAt" LIMIT 1 FOR UPDATE SKIP LOCKED`;
      if(!rows.length)return null;
      return tx.emailDelivery.update({where:{id:rows[0].id},data:{status:"SENDING",lockedAt:new Date(),attempts:{increment:1}}});
    });
    if(!delivery)break;
    try {
      let response:Response;
      if(process.env.NEXT_EMAIL_BRIDGE_URL && process.env.NEXT_EMAIL_PRIVATE_KEY) {
        const body=JSON.stringify({id:delivery.id,to:delivery.recipient,subject:delivery.subject,text:delivery.text,timestamp:Date.now()});
        const privateKey=createPrivateKey({key:Buffer.from(process.env.NEXT_EMAIL_PRIVATE_KEY,"base64"),type:"pkcs8",format:"der"});
        response=await fetch(process.env.NEXT_EMAIL_BRIDGE_URL,{method:"POST",headers:{"Content-Type":"application/json","X-Next-Signature":sign(null,Buffer.from(body),privateKey).toString("base64")},body,signal:AbortSignal.timeout(15000)});
      } else {
        response=await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,"Content-Type":"application/json","Idempotency-Key":`verbo-next/${delivery.id}`},body:JSON.stringify({from:process.env.RESEND_FROM_EMAIL,to:[delivery.recipient],subject:delivery.subject,text:delivery.text}),signal:AbortSignal.timeout(15000)});
      }
      const result=await response.json().catch(()=>({}));
      if(!response.ok||!result.id)throw new Error(`El proveedor rechazó el envío (HTTP ${response.status}).`);
      await prisma.emailDelivery.update({where:{id:delivery.id},data:{status:"SENT",providerId:String(result.id),sentAt:new Date(),lockedAt:null,lastError:null}});sent++;
    } catch(error) {
      await prisma.emailDelivery.update({where:{id:delivery.id},data:{status:"FAILED",lockedAt:null,lastError:error instanceof Error&&error.message.startsWith("El proveedor")?error.message:"No se pudo confirmar el envío. Revisa la conexión y reintenta."}});failed++;
    }
  }
  return {sent,failed,configured:true};
}
export async function queueAttemptEmails(tx:Prisma.TransactionClient,attemptId:string,event:"submitted"|"reviewed") {
  const attempt=await tx.attempt.findUniqueOrThrow({where:{id:attemptId},include:{student:true,examVersion:{include:{examType:true}}}});
  const student=attempt.student,exam=`${attempt.examVersion.examType.name} · ${attempt.examVersion.label}`;
  const origin=process.env.NEXTAUTH_URL??"https://next.verboacademic.com";
  await queueEmail(tx,{eventKey:`attempt:${attemptId}:${event}:student`,recipient:student.email,subject:event==="reviewed"?"Tu resultado está listo · Verbo NEXT":"Recibimos tu simulación · Verbo NEXT",text:`Hola, ${student.fullName}.\n\n${event==="reviewed"?"La revisión de tu simulación ha terminado. Ya puedes consultar tu resultado y tu constancia.":attempt.status==="PENDING_REVIEW"?"Recibimos tu simulación. Las respuestas abiertas están pendientes de revisión de tu profesor.":"Tu simulación ha terminado y tus resultados están disponibles."}\n\n${exam}\n${origin}/alumno/resultado/${attemptId}\n\nVerbo NEXT · Verbo Language Solutions`});
  if(student.teacherEmail) await queueEmail(tx,{eventKey:`attempt:${attemptId}:${event}:teacher`,recipient:student.teacherEmail,subject:`${event==="reviewed"?"Revisión finalizada":"Simulación enviada"} · ${student.fullName}`,text:`${student.fullName} (${student.email}) ${event==="reviewed"?"ya tiene su resultado revisado.":"completó su simulación."}\n\n${exam}\nEstado: ${attempt.status==="PENDING_REVIEW"?"Pendiente de revisión":"Evaluación terminada"}.\n\nEl equipo autorizado puede consultar el intento en ${origin}/admin/revision/${attemptId}\n\nVerbo NEXT`});
}
