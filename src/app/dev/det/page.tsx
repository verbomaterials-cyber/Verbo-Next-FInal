import { notFound } from "next/navigation";
import { detForm, detForms } from "../../../../content/det-2026/forms";
import { detMetadata, detPublicPrompt } from "@/lib/det-format";
import { DetEngine } from "@/components/exam/det-engine";
import { examFontClass } from "@/lib/fonts";
import Link from "next/link";
export default async function DetPreviewPage({searchParams}:{searchParams:Promise<{key?:string;form?:string;phase?:string}>}){
  if(process.env.NODE_ENV!=="development")notFound();
  const {key,form="1",phase}=await searchParams;
  const selected=detForms.find(f=>f.id===form);if(!selected)notFound();
  const questions=detForm(form).questions;
  const delivered=questions.filter(q=>!detMetadata(q.prompt)?.slot||detMetadata(q.prompt)?.level===3);
  const q=questions.find(q=>q.key===(key??"reading-1-highlight-1"));if(!q)notFound();
  // Preview clocks are relative to mount; authenticated attempts use server deadlines.
  const meta=detMetadata(q.prompt)!;const now=0,prep=phase==="prep"&&meta.prep>0,seconds=prep?meta.prep:meta.group?.seconds??meta.seconds;
  const index=delivered.findIndex(item=>item.key===q.key);
  const href=(key:string)=>`/dev/det?form=${form}&key=${key}`;
  return <div className={examFontClass}>
    <nav aria-label="Development previews" className="fixed inset-x-0 top-0 z-50 flex h-[54px] items-center justify-between gap-3 overflow-x-auto bg-[#243746] px-4 text-xs whitespace-nowrap text-white">
      <div className="flex items-center gap-3">{detForms.map(f=><Link key={f.id} href={`/dev/det?form=${f.id}&key=${q.key}`} className={`rounded px-3 py-2 ${f.id===form?"bg-white/20":"hover:bg-white/10"}`}>{f.id==="diagnostic"?"Diagnóstico":`Simulador ${f.id}`}</Link>)}</div>
      <div className="flex items-center gap-4"><Link href={href(delivered[Math.max(0,index-1)].key)}>←</Link><span>{index+1} / {delivered.length}</span><Link href={href(delivered[Math.min(delivered.length-1,index+1)].key)}>→</Link>{meta.prep>0&&<Link href={`${href(q.key)}&phase=${prep?"answer":"prep"}`}>{prep?"Respuesta":"Preparación"}</Link>}<Link href="/alumno/examen/det">Catálogo</Link></div>
    </nav>
    <DetEngine key={`${form}:${q.key}:${prep}`} preview attemptId="preview" initialRuntime={{index:0,maxIndex:0,serverNow:now,deadlineAt:now+seconds*1000,totalSeconds:seconds,phase:prep?"prep":meta.task==="interview"?"stimulus":"answer",finished:false,audioPlays:{}}}
    screen={{id:q.key,name:q.type,prompt:detPublicPrompt(q.prompt),meta,answer:{},progress:index,total:delivered.length,previousText:meta.previousKey?"We planned an activity together, but a sudden change meant that everyone had to adapt. I explained the alternatives, listened to the group's concerns, and suggested a smaller plan that we could complete in the time available. The experience taught me to leave room for unexpected events and make sure everyone understands their role.":undefined}}/>
  </div>;
}
