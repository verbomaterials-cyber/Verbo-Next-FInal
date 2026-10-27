import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { PrismaClient, type Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { detMetadata, detSolutionAnswer, DET_FORMAT, DET_RUBRIC_VERSION } from "../src/lib/det-format";
import { toneWavDataUri } from "../prisma/seed-data/sample-questions";
import { detForm } from "../content/det-2026/forms";
const DET_FORM_LABEL=detForm(process.argv.find(a=>a.startsWith("--form="))?.slice(7)??"1").label;
const base="http://127.0.0.1:3000", dbUrl=new URL(process.env.DATABASE_URL??"");
if(dbUrl.hostname!=="127.0.0.1"||dbUrl.port!=="54329"||dbUrl.pathname!=="/verbo_next")throw new Error("Solo se permite la base local.");
const db=new PrismaClient(),jar=new Map<string,string>();
async function request(path:string,init:RequestInit={}){const response=await fetch(base+path,{...init,headers:{Cookie:[...jar].map(([k,v])=>`${k}=${v}`).join("; "),...init.headers},redirect:"manual"});for(const value of response.headers.getSetCookie()){const pair=value.split(";",1)[0],sep=pair.indexOf("=");jar.set(pair.slice(0,sep),pair.slice(sep+1));}return response;}
async function login(email:string,password:string){jar.clear();const csrf=await(await request("/api/auth/csrf")).json();const response=await request("/api/auth/callback/credentials",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({email,password,csrfToken:csrf.csrfToken,json:"true",callbackUrl:base})});assert.equal(response.status,200);assert.equal((await(await request("/api/auth/session")).json()).user.email,email);}
async function action(name:string,input:unknown,page="/alumno/examen/det"){
  const manifest=JSON.parse(await readFile(".next/dev/server/server-reference-manifest.json","utf8"));
  const entry=Object.entries(manifest.node).find(([,raw])=>{const v=raw as {exportedName?:string;workers?:Record<string,{exportedName?:string}>};return v.exportedName===name||Object.values(v.workers??{}).some(w=>w.exportedName===name);});assert.ok(entry,`Acción compilada: ${name}`);
  const response=await request(page,{method:"POST",headers:{"Next-Action":entry[0],"Content-Type":"application/json",Origin:base},body:JSON.stringify([input])});const body=await response.text();assert.equal(response.status,200,`${name}: HTTP ${response.status}`);
  for(const line of body.split("\n")){try{const v=JSON.parse(line.slice(line.indexOf(":")+1));if(typeof v?.ok==="boolean")return v;}catch{}}
  throw new Error(`Resultado no encontrado: ${name}`);
}
async function main(){let studentId:string|undefined;try{
  const lower=process.argv.includes("--lower"),version=await db.examVersion.findFirstOrThrow({where:{label:DET_FORM_LABEL,examType:{slug:"det"}},include:{questions:{include:{questionType:true}}}});
  const password=randomBytes(18).toString("base64url"),student=await db.student.create({data:{fullName:"Verificación DET temporal",email:`verify-det-${randomBytes(6).toString("hex")}@verbo.local`,passwordHash:await bcrypt.hash(password,10)}});studentId=student.id;
  const enrollment=await db.enrollment.create({data:{studentId,examTypeId:version.examTypeId,accessCode:randomBytes(8).toString("hex"),attemptsAllowed:1,unlockedVersions:[version.id]}});
  await login(student.email,password);assert.equal((await request("/alumno/examen/det")).status,200);
  assert.equal((await action("startAttempt",{examVersionId:version.id})).ok,false,"El código de acceso es obligatorio.");
  assert.equal((await action("verifyAccessCode",{slug:"det",code:enrollment.accessCode})).ok,true);
  const starts=await Promise.all([action("startAttempt",{examVersionId:version.id}),action("startAttempt",{examVersionId:version.id})]);assert.ok(starts.every(s=>s.ok));assert.equal(starts[0].data.attemptId,starts[1].data.attemptId);assert.equal((await db.enrollment.findUniqueOrThrow({where:{id:enrollment.id}})).attemptsUsed,1);
  const attemptId=starts[0].data.attemptId,page=`/alumno/intento/${attemptId}`;
  const html=await(await request(page)).text();assert.ok(!html.includes("Describe a practical skill"),"No se envían consignas futuras.");assert.ok(!html.includes("plausivity"),"No se envían variantes no elegidas.");assert.ok(!html.includes('"_transcript"'));
  let cursor=(await action("getAttemptProgress",attemptId,page)).data;
  assert.equal((await action("getAttemptProgress",attemptId,page)).data.deadlineAt,cursor.deadlineAt);
  if(process.argv.includes("--expire-early")){
    const attempt=await db.attempt.findUniqueOrThrow({where:{id:attemptId}});
    await db.attempt.update({where:{id:attemptId},data:{runtimeState:{...(attempt.runtimeState as Prisma.JsonObject),examDeadlineAt:Date.now()-1000,deadlineAt:Date.now()-1000}}});
    const next=await action("navigateAttempt",{attemptId,questionId:cursor.questionId,answerContent:{},isFlagged:false,direction:"next"},page);assert.equal(next.data.finished,true);
    assert.equal((await action("completeAttempt",{attemptId},page)).ok,true);
    const result=await db.attempt.findUniqueOrThrow({where:{id:attemptId}}),score=result.overallScore as {value:number;raw:Record<string,{possible:number}>};
    assert.equal(result.status,"COMPLETED");assert.equal(score.value,0);assert.deepEqual(Object.fromEntries(Object.entries(score.raw).map(([k,v])=>[k,v.possible])),{Reading:54,Listening:22,Writing:40,Speaking:45});
    console.log("DET: plazo global agotado, respuestas ausentes en cero y máximos completos sin contar variantes descartadas.");return;
  }
  assert.equal((await action("completeAttempt",{attemptId},page)).ok,false);
  const foreign=await db.question.findFirstOrThrow({where:{examVersion:{examType:{slug:"toefl-ibt"}}}});
  assert.equal((await action("saveResponse",{attemptId,questionId:foreign.id,answerContent:{text:"invalid"},isFlagged:false},page)).ok,false);
  let visited=0,recordings=0;const seen=new Set<string>();
  while(!cursor.finished){assert.ok(visited++<version.questions.length);const q=version.questions.find(q=>q.id===cursor.questionId)!;assert.ok(q);assert.ok(!seen.has(q.id));seen.add(q.id);const meta=detMetadata(q.promptContent)!;
    if(cursor.phase==="prep"){
      assert.equal((await action("saveResponse",{attemptId,questionId:q.id,answerContent:{text:"too early"},isFlagged:false},page)).ok,false);
      const start=await action("beginSpeaking",{attemptId,questionId:q.id},page);assert.equal(start.ok,true);cursor=start.data;
    }
    if(meta.task==="dictation" || meta.task==="interview" || meta.task==="listen-respond"){
      if(meta.task==="interview")assert.equal((await action("beginSpeaking",{attemptId,questionId:q.id},page)).ok,false,"No se puede iniciar la respuesta antes de escuchar.");
      const limit=meta.task==="dictation"?3:1;
      for(let i=0;i<limit;i++)assert.equal((await action("markAudioPlayed",{attemptId,questionId:q.id},page)).ok,true);
      assert.equal((await action("markAudioPlayed",{attemptId,questionId:q.id},page)).ok,false,"El límite de reproducción persiste en servidor.");
      if(meta.task==="interview"){const start=await action("beginSpeaking",{attemptId,questionId:q.id},page);assert.equal(start.ok,true);assert.equal(start.data.totalSeconds,35);cursor=start.data;}
    }
    let answer=q.correctAnswer?detSolutionAnswer(q.correctAnswer as Record<string,unknown>):{text:"This original practice response explains the situation, develops relevant ideas, and gives a specific example to support the conclusion."};
    if(lower&&meta.slot)answer={};
    if(process.argv.includes("--paraphrase")&&meta.key==="listening-1-complete")answer={answers:["the history of our neighbourhood","next Thursday","projection equipment"]};
    if(q.questionType.responseType==="AUDIO_RECORDING"){
      const audio=Buffer.from(toneWavDataUri(1).split(",")[1],"base64"),endpoint=`/api/intentos/${attemptId}/grabacion/${q.id}`;
      const upload=await request(endpoint,{method:"POST",headers:{"Content-Type":"audio/wav","x-duration-seconds":"1",Origin:base},body:audio});assert.equal(upload.status,200);answer=await upload.json();recordings++;
      assert.deepEqual(Buffer.from(await(await request(endpoint)).arrayBuffer()),audio);assert.equal((await fetch(base+endpoint)).status,401);
    }
    const input={attemptId,questionId:q.id,answerContent:answer,isFlagged:false,direction:"next"};
    const next=await action("navigateAttempt",input,page);assert.equal(next.ok,true,`${q.questionType.name}: ${next.error}`);
    const retry=await action("navigateAttempt",input,page);assert.equal(retry.data.questionId,next.data.questionId);assert.equal(retry.data.finished,next.data.finished);cursor=next.data;
  }
  assert.equal(visited,DET_FORMAT.practiceScreens);assert.equal(recordings,9);
  const selected=version.questions.find(q=>q.id===cursor.detSelections["word-2"])!;assert.equal(detMetadata(selected.promptContent)?.level,lower?1:5);
  assert.equal(await db.response.count({where:{attemptId}}),72,"Solo se guardan respuestas de la variante seleccionada.");
  const complete=await Promise.all([action("completeAttempt",{attemptId},page),action("completeAttempt",{attemptId},page)]);assert.ok(complete.every(r=>r.ok));
  const pending=await db.attempt.findUniqueOrThrow({where:{id:attemptId}});assert.equal(pending.status,"PENDING_REVIEW");assert.equal((pending.overallScore as {value:unknown}).value,null);
  const credentials=JSON.parse(await readFile(".local/access.json","utf8"));await login(credentials.admin.email,credentials.admin.password);assert.equal((await request(`/admin/revision/${attemptId}`)).status,200);
  const responses=await db.response.findMany({where:{attemptId,OR:[{question:{questionType:{responseType:{in:["FREE_TEXT","AUDIO_RECORDING"]}}}},{isCorrect:null,question:{questionType:{responseType:"FILL_BLANK"}}}]},include:{question:true}});assert.equal(responses.length,process.argv.includes("--paraphrase")?18:17);
  for(const r of responses){const result=await action("reviewResponse",{responseId:r.id,verdict:"reviewed",reviewNotes:"Evaluación temporal de verificación; no pertenece a un alumno real.",rubricScore:detMetadata(r.question.promptContent)?.task==="listen-complete"?5:4},`/admin/revision/${attemptId}`);assert.equal(result.ok,true);}
  const final=await db.attempt.findUniqueOrThrow({where:{id:attemptId},include:{responses:true}});assert.equal(final.status,"COMPLETED");const score=final.overallScore as {value:number;raw:Record<string,{earned:number;possible:number}>;scoringVersion:string};assert.equal(score.scoringVersion,"verbo-det-practice-v1");if(!lower)assert.equal(score.value,90);
  assert.equal(final.responses.filter(r=>(r.reviewAssessment as {version?:string}|null)?.version===DET_RUBRIC_VERSION).length,responses.length);
  await login(student.email,password);assert.equal((await request(`/alumno/resultado/${attemptId}`)).status,200);assert.notEqual((await request(`/admin/revision/${attemptId}`)).status,200);
  console.log(JSON.stringify({verified:true,route:lower?"lower":"upper",screens:visited,recordings,rubricReviews:responses.length,practiceIndex:score.value,raw:score.raw,checks:["Login y código", "Inicios y envíos concurrentes idempotentes","Consignas y variantes futuras ocultas","Relojes persistentes","Límites de audio 3/1 en servidor","Preparación separada","Grabaciones privadas y reproducción exacta","72 pantallas y selección de dificultad","17 rúbricas y resultado completo","Permisos de alumno/profesor"]},null,2));
}finally{if(studentId){const attempts=await db.attempt.findMany({where:{studentId},select:{id:true}});await db.notification.deleteMany({where:{attemptId:{in:attempts.map(a=>a.id)}}});await db.student.delete({where:{id:studentId}});}await db.$disconnect();}}
main().catch(e=>{console.error(e);process.exitCode=1;});
