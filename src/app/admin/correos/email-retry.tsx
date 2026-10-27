"use client";
import { useState,useTransition } from "react";
import { retryEmails } from "@/lib/admin/email-actions";
import { Button } from "@/components/ui";
export function EmailRetry({configured}:{configured:boolean}) {
  const [pending,startTransition]=useTransition();const [message,setMessage]=useState("");
  return <div><Button disabled={pending||!configured} onClick={()=>startTransition(async()=>{try{const r=await retryEmails();setMessage(r.ok?r.message??"Procesado":r.error??"No se pudo procesar.");}catch{setMessage("No se pudo procesar la cola. Intenta de nuevo.");}})}>{pending?"Procesando…":"Procesar pendientes y reintentar"}</Button>{message&&<p role="status" className="mt-3 text-sm">{message}</p>}</div>;
}
