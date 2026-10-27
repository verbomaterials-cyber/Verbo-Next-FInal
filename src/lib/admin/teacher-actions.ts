"use server";
import {getServerSession} from "next-auth";
import {revalidatePath} from "next/cache";
import {z} from "zod";
import bcrypt from "bcryptjs";
import {randomBytes} from "node:crypto";
import {authOptions} from "@/lib/auth";
import {prisma} from "@/lib/prisma";
import {reserveAccountEmail,AccountInputError} from "./accounts";
import {queueEmail,scheduleEmails} from "@/lib/email";
const inputZ=z.object({fullName:z.string().trim().min(2).max(100),email:z.string().trim().toLowerCase().email(),isActive:z.boolean().optional(),password:z.union([z.string().min(8).max(200),z.literal("")]).optional()}).strict();
async function requireAdmin(){const session=await getServerSession(authOptions);if(session?.user.role!=="ADMIN")throw new Error("No autorizado.");}
function errorResult(error:unknown){return {ok:false as const,error:error instanceof AccountInputError?error.message:error instanceof z.ZodError?error.issues[0].message:"No se pudo guardar el profesor."};}
export async function createTeacher(input:unknown){try{await requireAdmin();const data=inputZ.parse(input);const password=data.password||randomBytes(12).toString("base64url"),passwordHash=await bcrypt.hash(password,12);await prisma.$transaction(async tx=>{await reserveAccountEmail(tx,data.email);const teacher=await tx.teacher.create({data:{fullName:data.fullName,email:data.email,passwordHash}});await queueEmail(tx,{eventKey:`teacher:${teacher.id}:welcome`,recipient:teacher.email,subject:"Tu espacio docente está listo · Verbo NEXT",text:`Hola, ${teacher.fullName}.\n\nTu cuenta de profesor está lista. Entra con ${teacher.email} en ${process.env.NEXTAUTH_URL??"https://next.verboacademic.com"}/login. La administración te compartirá tu contraseña por un canal privado y te asignará tus alumnos.\n\nVerbo NEXT · Verbo Language Solutions`});});revalidatePath("/admin","layout");scheduleEmails();return {ok:true as const,password};}catch(error){return errorResult(error);}}
export async function updateTeacher(id:string,input:unknown){try{await requireAdmin();const data=inputZ.omit({password:true}).parse(input);await prisma.$transaction(async tx=>{await reserveAccountEmail(tx,data.email,{kind:"teacher",id});await tx.teacher.update({where:{id},data});await tx.student.updateMany({where:{teacherId:id},data:{teacherEmail:data.email}});});revalidatePath("/admin","layout");revalidatePath("/profesor","layout");return {ok:true as const};}catch(error){return errorResult(error);}}
export async function resetTeacherPassword(id:string,input?:string){try{await requireAdmin();const parsed=z.string().min(8).max(200).optional().parse(input||undefined),password=parsed||randomBytes(12).toString("base64url");await prisma.teacher.update({where:{id},data:{passwordHash:await bcrypt.hash(password,12)}});scheduleEmails();return {ok:true as const,password};}catch(error){return errorResult(error);}}

