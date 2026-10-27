import assert from "node:assert/strict";
import {readFile,writeFile} from "node:fs/promises";
import {randomBytes} from "node:crypto";
import {PrismaClient} from "@prisma/client";
import {productionConnections,productionOrigin} from "./production-target.mjs";
import {mexicoWeek} from "../src/lib/study-plan";
import {toneWavDataUri} from "../prisma/seed-data/sample-questions";
const official=process.argv.includes("--official");
const localUrl=new URL(process.env.DATABASE_URL??"http://localhost");
if(!official&&(localUrl.hostname!=="127.0.0.1"||localUrl.pathname!=="/verbo_next"))throw new Error("Only local verification or explicitly pinned --official is allowed.");
const base=official?productionOrigin:"http://127.0.0.1:3000";
let db:PrismaClient;const jar=new Map<string,string>(),actionMap=new Map<string,string>();
const suffix=randomBytes(6).toString("hex"),password=randomBytes(18).toString("base64url");
const email=(name:string)=>official?`delivered+next-${name}-${suffix}@resend.dev`:`next-${name}-${suffix}@verbo.local`;
const teacherEmails=[email("teacher-a"),email("teacher-b")],studentEmails=[email("student-a"),email("student-b")];
const teacherIds:string[]=[],studentIds:string[]=[];
const checks:string[]=[];
async function request(path:string,init:RequestInit={}){const r=await fetch(base+path,{...init,redirect:"manual",headers:{Cookie:[...jar].map(([k,v])=>`${k}=${v}`).join("; "),...init.headers}});for(const v of r.headers.getSetCookie()){const p=v.split(";",1)[0],i=p.indexOf("=");jar.set(p.slice(0,i),p.slice(i+1));}return r;}
async function login(mail:string,pass=password){jar.clear();const csrf=await(await request("/api/auth/csrf")).json();const r=await request("/api/auth/callback/credentials",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({email:mail,password:pass,csrfToken:csrf.csrfToken,json:"true",callbackUrl:base})});assert.ok([200,401].includes(r.status));return(await request("/api/auth/session")).json();}
async function warm(path:string){const r=await request(path);assert.equal(r.status,200,path);const html=await r.text();if(official){const sources=[...html.matchAll(/<script[^>]*src="([^"]+\.js[^\"]*)"/g)].map(m=>m[1].replaceAll("&amp;","&"));for(const src of sources){const js=await(await request(src)).text();for(const m of js.matchAll(/createServerReference\)\("([0-9a-f]+)",.{0,160}?,"([A-Za-z]+)"\)/g))actionMap.set(m[2],m[1]);}}return html;}
async function action(name:string,args:unknown[],path:string){let id=actionMap.get(name);if(!official){const manifest=JSON.parse(await readFile(".next/dev/server/server-reference-manifest.json","utf8"));const entry=Object.entries(manifest.node).find(([,v])=>{const a=v as {exportedName?:string;workers?:Record<string,{exportedName?:string}>};return a.exportedName===name||Object.values(a.workers??{}).some(w=>w.exportedName===name);});id=entry?.[0];}assert.ok(id,`compiled ${name}`);const r=await request(path,{method:"POST",headers:{"Next-Action":id,"Content-Type":"application/json",Origin:base},body:JSON.stringify(args)});const text=await r.text();if(r.status!==200)return {ok:false,error:`HTTP ${r.status}`};for(const line of text.split("\n")){try{const value=JSON.parse(line.slice(line.indexOf(":")+1));if(typeof value?.ok==="boolean")return value;}catch{}}throw new Error(`No result for ${name}`);}
async function main(){
  db=official?new PrismaClient({datasourceUrl:(await productionConnections()).DIRECT_URL}):new PrismaClient();
  const before={students:await db.student.count(),teachers:await db.teacher.count(),attempts:await db.attempt.count(),questions:await db.question.count()};
  const access=JSON.parse(await readFile(official?".local/deploy/access.json":".local/access.json","utf8"));
  try{
    assert.equal((await login(access.admin.email,access.admin.password)).user.role,"ADMIN");await warm("/admin/profesores");await warm("/admin/alumnos");
    for(let i=0;i<2;i++){assert.equal((await action("createTeacher",[{fullName:`Profesor temporal ${i+1}`,email:teacherEmails[i],password}],"/admin/profesores")).ok,true);teacherIds.push((await db.teacher.findUniqueOrThrow({where:{email:teacherEmails[i]}})).id);}
    for(let i=0;i<2;i++){assert.equal((await action("createStudent",[{fullName:`Alumno temporal ${i+1}`,email:studentEmails[i],password,teacherId:teacherIds[i]}],"/admin/alumnos")).ok,true);studentIds.push((await db.student.findUniqueOrThrow({where:{email:studentEmails[i]}})).id);}
    assert.equal((await action("createTeacher",[{fullName:"Colisión temporal",email:studentEmails[0],password}],"/admin/profesores")).ok,false);
    checks.push("admin creates teachers, assigns students and rejects cross-role duplicate emails");
    const version=await db.examVersion.findFirstOrThrow({where:{examType:{slug:"toefl-ibt"},label:"Diagnóstico"},include:{questions:{include:{questionType:true}}}});
    const open=version.questions.find(q=>q.questionType.responseType==="FREE_TEXT")!,speaking=version.questions.find(q=>q.questionType.responseType==="AUDIO_RECORDING")!;assert.ok(open&&speaking);
    const plans=[];const attempts=[];const responses=[];
    for(let i=0;i<2;i++){
      plans.push(await db.enrollment.create({data:{studentId:studentIds[i],examTypeId:version.examTypeId,accessCode:randomBytes(7).toString("hex"),attemptsAllowed:5,unlockedVersions:[version.id]}}));
      const attempt=await db.attempt.create({data:{studentId:studentIds[i],examVersionId:version.id,status:"PENDING_REVIEW",completedAt:new Date()}});attempts.push(attempt);
      responses.push(await db.response.create({data:{attemptId:attempt.id,questionId:open.id,answerContent:{text:"Temporary integration answer"}}}));
    }
    const audio=Buffer.from(toneWavDataUri(1).split(",")[1],"base64");
    const recording=await db.recording.create({data:{attemptId:attempts[0].id,questionId:speaking.id,content:audio,mimeType:"audio/wav",durationSeconds:1}});
    const spoken=await db.response.create({data:{attemptId:attempts[0].id,questionId:speaking.id,answerContent:{recorded:true,recordingId:recording.id,durationSeconds:1,audioUrl:`/api/intentos/${attempts[0].id}/grabacion/${speaking.id}`}}});
    assert.equal((await login(teacherEmails[0])).user.role,"TEACHER");
    const home=await warm("/profesor");assert.match(home,/Alumno temporal 1/);assert.ok(!home.includes("Alumno temporal 2"));
    const own=`/profesor/alumnos/${studentIds[0]}`,ownReview=`/profesor/revision/${attempts[0].id}`,foreignReview=`/profesor/revision/${attempts[1].id}`;
    await warm(own);await warm(ownReview);
    assert.equal((await request(`/profesor/alumnos/${studentIds[1]}`)).status,404);assert.equal((await request(foreignReview)).status,404);assert.ok([302,307].includes((await request("/admin/profesores")).status));
    const audioPath=`/api/intentos/${attempts[0].id}/grabacion/${speaking.id}`;
    const audioResponse=await request(audioPath);assert.equal(audioResponse.status,200);assert.deepEqual(Buffer.from(await audioResponse.arrayBuffer()),audio);
    const planInput={enrollmentId:plans[0].id,targetScore:4.5,targetDate:"2026-12-20",weeklyGoal:3,focusSkills:["SPEAKING","WRITING"]};
    assert.equal((await action("saveStudyPlan",[planInput],own)).ok,true);
    assert.equal((await action("saveStudyPlan",[{...planInput,enrollmentId:plans[1].id}],own)).ok,false);
    assert.equal((await action("saveStudyPlan",[{...planInput,targetScore:120}],own)).ok,false);
    assert.equal((await action("saveTeachingNote",[{enrollmentId:plans[0].id,note:"Prioriza una idea, una razón y un ejemplo."}],own)).ok,true);
    assert.equal((await action("reviewResponse",[{responseId:responses[1].id,verdict:"correct",reviewNotes:"Must be rejected",rubricScore:4}],ownReview)).ok,false);
    assert.equal((await action("reviewResponse",[{responseId:responses[0].id,verdict:"correct",reviewNotes:"Revisión del profesor asignado.",rubricScore:4}],ownReview)).ok,true);
    checks.push("teacher sees only assigned students, cannot read or grade foreign attempts, and can hear owned recordings");
    checks.push("teacher edits owned plans and notes while foreign plans and official-score substitutions are rejected");
    if(official)await db.emailDelivery.create({data:{eventKey:`attempt:${attempts[0].id}:submitted:teacher`,recipient:teacherEmails[0],subject:"Verificación de aviso anterior",status:"FAILED",text:"Aviso de prueba pendiente antes de una reasignación."}});
    await login(access.admin.email,access.admin.password);
    assert.equal((await action("updateStudent",[studentIds[0],{fullName:"Alumno temporal 1",email:studentEmails[0],teacherId:teacherIds[1]}],"/admin/alumnos")).ok,true);
    if(official)await db.emailDelivery.update({where:{eventKey:`attempt:${attempts[0].id}:submitted:teacher`},data:{status:"PENDING"}});
    await login(teacherEmails[0]);assert.equal((await request(own)).status,404);assert.equal((await request(ownReview)).status,404);assert.equal((await request(audioPath)).status,404);
    assert.equal((await action("reviewResponse",[{responseId:spoken.id,verdict:"correct",reviewNotes:"Must be rejected",rubricScore:4}],ownReview)).ok,false);
    assert.equal((await db.response.findUniqueOrThrow({where:{id:spoken.id}})).isCorrect,null,"revoked teacher must not change the response");
    await login(teacherEmails[1]);await warm(own);await warm(ownReview);assert.equal((await action("reviewResponse",[{responseId:spoken.id,verdict:"correct",reviewNotes:"Seguimiento del nuevo profesor.",rubricScore:4}],ownReview)).ok,true);
    const teacherNotice=await db.emailDelivery.findUniqueOrThrow({where:{eventKey:`attempt:${attempts[0].id}:reviewed:teacher`}});assert.equal(teacherNotice.recipient,teacherEmails[1]);assert.ok(teacherNotice.text.includes(`/profesor/revision/${attempts[0].id}`));
    checks.push("reassignment immediately revokes previous teacher access to pages, audio and mutations; review notice uses the new teacher and portal");
    const week=mexicoWeek();
    await db.attempt.createMany({data:[{studentId:studentIds[0],examVersionId:version.id,status:"COMPLETED",completedAt:new Date(),overallScore:{scoringVersion:"verbo-toefl-practice-v1",value:4.5}},{studentId:studentIds[0],examVersionId:version.id,status:"COMPLETED",completedAt:new Date(week.start.getTime()-1000),overallScore:{scoringVersion:"verbo-toefl-practice-v1",value:3}},{studentId:studentIds[0],examVersionId:version.id,status:"IN_PROGRESS"}]});
    await login(studentEmails[0]);const planHtml=await warm("/alumno/plan");assert.match(planHtml.replace(/<!--.*?-->/g,""),/2\/3/);assert.match(planHtml,/Prioriza una idea/);assert.match(planHtml,/alcanzó tu meta de práctica/);
    assert.equal((await action("saveStudyPlan",[{...planInput,weeklyGoal:2}],"/alumno/plan")).ok,true);assert.equal((await action("saveTeachingNote",[{enrollmentId:plans[0].id,note:"Unauthorized student change"}],"/alumno/plan")).ok,false);assert.equal((await action("saveStudyPlan",[{...planInput,enrollmentId:plans[1].id}],"/alumno/plan")).ok,false);
    checks.push("student sees actual weekly submitted attempts, target achievement and teacher guidance; cannot edit teacher notes or another student's plan");
    await login(teacherEmails[0]);const oldTeacherSession=new Map(jar);await login(access.admin.email,access.admin.password);assert.equal((await action("resetTeacherPassword",[teacherIds[0],password+"reset"],"/admin/profesores")).ok,true);jar.clear();for(const [k,v] of oldTeacherSession)jar.set(k,v);assert.equal((await(await request("/api/auth/session")).json())?.user,undefined);
    await login(access.admin.email,access.admin.password);assert.equal((await action("updateTeacher",[teacherIds[1],{fullName:"Profesor temporal 2",email:teacherEmails[1],isActive:false}],"/admin/profesores")).ok,true);assert.equal((await login(teacherEmails[1]))?.user,undefined);
    assert.equal((await action("createTeacher",[{fullName:"Forbidden",email:email("forbidden"),password}],"/profesor")).ok,false);assert.equal(await db.teacher.count({where:{email:email("forbidden")}}),0);
    checks.push("suspended teachers cannot sign in and unauthenticated callers cannot create teachers");
    if(official){for(let i=0;i<12;i++){const pending=await db.emailDelivery.count({where:{recipient:{in:[...teacherEmails,...studentEmails]},status:{notIn:["SENT","CANCELED"]}}});if(!pending)break;await new Promise(r=>setTimeout(r,1000));}assert.equal(await db.emailDelivery.count({where:{recipient:{in:[...teacherEmails,...studentEmails]},status:{notIn:["SENT","CANCELED"]}}}),0,"test notices accepted by Resend");const canceled=await db.emailDelivery.findUniqueOrThrow({where:{eventKey:`attempt:${attempts[0].id}:submitted:teacher`}});assert.equal(canceled.status,"CANCELED");assert.equal(canceled.providerId,null);checks.push("queued notices for a previous teacher are canceled before sending");}
    const report={environment:official?base:"local",result:"passed",checks};console.log(JSON.stringify(report,null,2));await writeFile(official?".local/deploy/teaching-live-verification.json":".local/teaching-verification.json",JSON.stringify(report,null,2));
  }finally{
    await db.emailDelivery.deleteMany({where:{recipient:{in:[...teacherEmails,...studentEmails]}}});
    const attempts=await db.attempt.findMany({where:{studentId:{in:studentIds}},select:{id:true}});await db.notification.deleteMany({where:{attemptId:{in:attempts.map(a=>a.id)}}});await db.student.deleteMany({where:{id:{in:studentIds}}});await db.teacher.deleteMany({where:{id:{in:teacherIds}}});
    const after={students:await db.student.count(),teachers:await db.teacher.count(),attempts:await db.attempt.count(),questions:await db.question.count()};assert.deepEqual(after,before,"test records cleaned up without changing existing records");console.log(JSON.stringify({cleanup:"verified",before,after}));await db.$disconnect();
  }
}
main().catch(error=>{console.error(error);process.exitCode=1;});




