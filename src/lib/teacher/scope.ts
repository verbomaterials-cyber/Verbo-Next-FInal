import type { Prisma, PrismaClient } from "@prisma/client";
import type { Session } from "next-auth";
export type StaffUser = Session["user"];
export function currentTeacherRecipient(student: { teacherId?: string | null; teacherEmail?: string | null; teacher?: { email: string; isActive: boolean } | null }) {
  return student.teacherId ? student.teacher?.isActive ? student.teacher.email : null : student.teacherEmail || null;
}
export function staffStudentScope(user: StaffUser): Prisma.StudentWhereInput {
  if(user.role==="ADMIN")return {};
  if(user.role==="TEACHER")return {teacherId:user.id};
  return {id:{in:[]}};
}
export async function canReviewStudent(tx:Prisma.TransactionClient|PrismaClient,user:StaffUser,studentId:string) {
  return !!await tx.student.findFirst({where:{id:studentId,...staffStudentScope(user)},select:{id:true}});
}
