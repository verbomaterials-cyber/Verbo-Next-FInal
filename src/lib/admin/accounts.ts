import type {Prisma} from "@prisma/client";
export class AccountInputError extends Error {}
export async function reserveAccountEmail(tx:Prisma.TransactionClient,email:string,except?:{kind:"student"|"teacher";id:string}) {
  await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtext(${'verbo-account:'+email}))`;
  const [admin,student,teacher]=await Promise.all([tx.adminUser.findUnique({where:{email},select:{id:true}}),tx.student.findUnique({where:{email},select:{id:true}}),tx.teacher.findUnique({where:{email},select:{id:true}})]);
  if(admin || student&&!(except?.kind==="student"&&except.id===student.id) || teacher&&!(except?.kind==="teacher"&&except.id===teacher.id))throw new AccountInputError("Este correo ya tiene una cuenta. Utiliza otro correo.");
}
export async function teacherAssignment(tx:Prisma.TransactionClient,input:{teacherId?:string|null;teacherEmail?:string},existing?:{teacherId:string|null;teacherEmail:string|null}) {
  const teacherId=input.teacherId===undefined?existing?.teacherId??null:input.teacherId||null;
  if(teacherId){const teacher=await tx.teacher.findUnique({where:{id:teacherId},select:{email:true}});if(!teacher)throw new AccountInputError("El profesor seleccionado no existe.");return{teacherId,teacherEmail:teacher.email};}
  return{teacherId:null,teacherEmail:input.teacherEmail===undefined?existing?.teacherEmail??null:input.teacherEmail||null};
}
