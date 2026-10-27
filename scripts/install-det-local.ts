import { Prisma, PrismaClient, type ResponseType, type InputMedia } from "@prisma/client";
import { readFile } from "node:fs/promises";
import { detForm, detForms } from "../content/det-2026/forms";
import { detSchema, detTypes } from "../content/det-2026/catalog";
import { DET_FORMAT, detMetadata, detPoints, detSolutionAnswer } from "../src/lib/det-format";
const url=new URL(process.env.DATABASE_URL??"");
if(url.hostname!=="127.0.0.1"||url.port!=="54329"||url.pathname!=="/verbo_next")throw new Error("Solo se admite la base local verbo_next.");
const db=new PrismaClient();
async function install(form: ReturnType<typeof detForm>){
  const { label: DET_FORM_LABEL, deliveredScreens: DET_DELIVERED_SCREENS, questions, audioScripts } = form;
  const exam=await db.examType.findUniqueOrThrow({where:{slug:"det"}});
  const version=await db.examVersion.findFirst({where:{examTypeId:exam.id,label:DET_FORM_LABEL},include:{_count:{select:{questions:true,attempts:true}}}});
  const existing=version?version._count:{questions:0,attempts:0};
  for(const q of questions){if(!detMetadata(q.prompt)||!detTypes.some(t=>t[0]===q.type))throw new Error(`Pregunta inválida: ${q.key}`);if(q.answer&&detPoints(q.prompt,q.answer,detSolutionAnswer(q.answer)).earned!==detPoints(q.prompt,q.answer,detSolutionAnswer(q.answer)).possible)throw new Error(`Clave inválida: ${q.key}`);}
  for(const script of audioScripts){const wav=await readFile(`public/audio/det-2026/${script.id}.wav`);if(wav.length<1000||wav.toString("ascii",0,4)!=="RIFF")throw new Error(`Audio inválido: ${script.id}`);}
  for(const photo of ["market","library","bicycle","park"]){const jpeg=await readFile(`public/images/det-2026/${photo}.jpg`);if(jpeg[0]!==255||jpeg[1]!==216)throw new Error("Foto no válida.");}
  console.log(JSON.stringify({target:`local / DET / ${DET_FORM_LABEL}`,format:DET_FORMAT.version,bankRecords:questions.length,deliveredScreens:DET_DELIVERED_SCREENS,audioFiles:audioScripts.length,existing,canInstall:!existing.questions&&!existing.attempts,preserves:"Otros exámenes, secciones antiguas, versiones, alumnos e intentos"},null,2));
  if(!process.argv.includes("--apply"))return;
  if(existing.questions||existing.attempts){console.log(`${DET_FORM_LABEL}: conservado sin cambios.`);return;}
  await db.$transaction(async tx=>{
    await tx.$queryRaw`SELECT "id" FROM "ExamType" WHERE "id"=${exam.id} FOR UPDATE`;
    const current=await tx.examVersion.findFirst({where:{examTypeId:exam.id,label:DET_FORM_LABEL},include:{_count:{select:{questions:true,attempts:true}}}});
    if(current&&(current._count.questions||current._count.attempts))throw new Error("La versión cambió durante la instalación.");
    const section=(await tx.section.findFirst({where:{examTypeId:exam.id,name:"DET · formato octubre 2026"}}))??await tx.section.create({data:{examTypeId:exam.id,name:"DET · formato octubre 2026",durationMinutes:60,skillsMeasured:["READING","LISTENING","WRITING","SPEAKING"]}});
    const ids=new Map<string,string>();
    for(const [name,responseType,inputMedia,seconds,skill] of detTypes){const qt=(await tx.questionType.findFirst({where:{sectionId:section.id,name}}))??await tx.questionType.create({data:{sectionId:section.id,name,responseType:responseType as ResponseType,inputMedia:inputMedia as InputMedia,timingMode:"PER_QUESTION",timePerItemSeconds:seconds,isScored:true,subscoreMapping:[skill],adminFieldSchema:detSchema as unknown as Prisma.InputJsonValue}});ids.set(name,qt.id);}
    const installed=current??await tx.examVersion.create({data:{examTypeId:exam.id,label:DET_FORM_LABEL,isPublished:false,hasFeedback:form.hasFeedback}});
    await tx.question.createMany({data:questions.map((q,i)=>({examVersionId:installed.id,questionTypeId:ids.get(q.type)!,order:i+1,promptContent:JSON.parse(JSON.stringify(q.prompt)),correctAnswer:q.answer?JSON.parse(JSON.stringify(q.answer)):Prisma.DbNull,feedbackText:q.feedback,difficultyLevel:q.difficulty}))});
    await tx.examVersion.update({where:{id:installed.id},data:{isPublished:true}});
    const demo=await tx.enrollment.findFirst({where:{examTypeId:exam.id,student:{email:"alumno@verbo.local"}}});
    if(demo&&!demo.unlockedVersions.includes(installed.id))await tx.enrollment.update({where:{id:demo.id},data:{unlockedVersions:{push:installed.id}}});
  },{timeout:20000});
  console.log("DET instalado y publicado. No se cambiaron los datos anteriores.");
}
async function main(){try{
  const forms=process.argv.includes("--all")?detForms:[detForm(process.argv.find(a=>a.startsWith("--form="))?.slice(7)??"1")];
  for(const form of forms)await install(form);
}finally{await db.$disconnect();}}
main().catch(e=>{console.error(e);process.exitCode=1;});
