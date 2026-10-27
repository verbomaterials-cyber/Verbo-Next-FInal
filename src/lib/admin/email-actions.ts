"use server";
import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { emailConfiguration,flushEmails } from "@/lib/email";
export async function retryEmails() {
  const session=await getServerSession(authOptions);
  if(!session||session.user.role!=="ADMIN")return {ok:false,error:"No autorizado."};
  if(!emailConfiguration().configured)return {ok:false,error:"El transporte de correo no está configurado."};
  // Process one bounded batch. Keep provider idempotency protection within 24 hours.
  await prisma.emailDelivery.updateMany({where:{status:"FAILED",createdAt:{gt:new Date(Date.now()-23*3600000)}},data:{status:"PENDING"}});
  const result=await flushEmails(8);
  revalidatePath("/admin/correos");
  return {ok:true,message:`${result.sent} aceptados por el proveedor; ${result.failed} fallidos. Puedes procesar otro lote si quedan pendientes.`};
}
