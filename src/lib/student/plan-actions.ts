"use server";
import {getServerSession} from "next-auth";
import {revalidatePath} from "next/cache";
import {z} from "zod";
import {authOptions} from "@/lib/auth";
import {prisma} from "@/lib/prisma";
import {studyPlanZ,validGoalScore} from "@/lib/study-plan";
import {canReviewStudent} from "@/lib/teacher/scope";
export async function saveStudyPlan(input:unknown){
  const session=await getServerSession(authOptions);if(!session)return {ok:false,error:"Inicia sesión para guardar tu plan."};
  const parsed=studyPlanZ.safeParse(input);if(!parsed.success)return {ok:false,error:"Revisa la meta, la fecha, las habilidades y el objetivo semanal (1 a 7)."};
  try{
    const data=parsed.data;
    await prisma.$transaction(async tx=>{
      const plan=await tx.enrollment.findUnique({where:{id:data.enrollmentId},include:{examType:{select:{slug:true}}}});
      if(!plan)throw new Error("No autorizado.");
      await tx.$queryRaw`SELECT "id" FROM "Student" WHERE "id" = ${plan.studentId} FOR SHARE`;
      const allowed=session.user.role==="STUDENT"?plan.studentId===session.user.id:await canReviewStudent(tx,session.user,plan.studentId);
      if(!allowed)throw new Error("No autorizado.");
      if(!validGoalScore(plan.examType.slug,data.targetScore))throw new Error("La meta no coincide con la escala de práctica del examen.");
      await tx.enrollment.update({where:{id:plan.id},data:{targetScore:data.targetScore,targetDate:data.targetDate||null,weeklyGoal:data.weeklyGoal,focusSkills:data.focusSkills}});
    });
    revalidatePath("/alumno","layout");revalidatePath("/profesor","layout");return {ok:true};
  }catch(error){return {ok:false,error:error instanceof Error&&error.message==="La meta no coincide con la escala de práctica del examen."?error.message:"No se pudo guardar el plan o no tienes acceso a este alumno."};}
}
export async function saveTeachingNote(input:unknown){
  const session=await getServerSession(authOptions);if(!session||!["ADMIN","TEACHER"].includes(session.user.role))return {ok:false,error:"No autorizado."};
  const parsed=z.object({enrollmentId:z.string().min(1),note:z.string().trim().max(2000)}).strict().safeParse(input);if(!parsed.success)return {ok:false,error:"La orientación admite hasta 2000 caracteres."};
  try{await prisma.$transaction(async tx=>{const plan=await tx.enrollment.findUniqueOrThrow({where:{id:parsed.data.enrollmentId}});await tx.$queryRaw`SELECT "id" FROM "Student" WHERE "id" = ${plan.studentId} FOR SHARE`;if(!await canReviewStudent(tx,session.user,plan.studentId))throw new Error("No autorizado.");await tx.enrollment.update({where:{id:plan.id},data:{teacherNote:parsed.data.note||null}});});revalidatePath("/alumno","layout");revalidatePath("/profesor","layout");return {ok:true};}catch{return {ok:false,error:"No se pudo guardar la orientación o no tienes acceso a este alumno."};}
}
