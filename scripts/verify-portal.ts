import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {randomBytes} from "node:crypto";
import {PrismaClient} from "@prisma/client";
import bcrypt from "bcryptjs";
const dbUrl=new URL(process.env.DATABASE_URL??"");
if(dbUrl.hostname!=="127.0.0.1"||dbUrl.pathname!=="/verbo_next")throw new Error("Only the local verification database is allowed.");
const db=new PrismaClient();const base="http://127.0.0.1:3000";const jar=new Map<string,string>();
async function request(path:string,init:RequestInit={}) {const r=await fetch(base+path,{...init,redirect:"manual",headers:{Cookie:[...jar].map(([k,v])=>`${k}=${v}`).join("; "),...init.headers}});for(const v of r.headers.getSetCookie()){const p=v.split(";",1)[0],i=p.indexOf("=");jar.set(p.slice(0,i),p.slice(i+1));}return r;}
async function login(email:string,password:string) {jar.clear();const csrf=await(await request("/api/auth/csrf")).json();await request("/api/auth/callback/credentials",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({email,password,csrfToken:csrf.csrfToken,json:"true",callbackUrl:base})});return(await request("/api/auth/session")).json();}
async function action(name:string,args:unknown[]) {await request("/admin/accesos");const manifest=JSON.parse(await readFile(".next/dev/server/server-reference-manifest.json","utf8"));const entry=Object.entries(manifest.node).find(([,v])=>{const a=v as {exportedName?:string;workers?:Record<string,{exportedName?:string}>};return a.exportedName===name||Object.values(a.workers??{}).some(w=>w.exportedName===name);});assert.ok(entry,`compiled action ${name}`);const r=await request("/admin/accesos",{method:"POST",headers:{"Next-Action":entry[0],"Content-Type":"application/json",Origin:base},body:JSON.stringify(args)});const body=await r.text();assert.equal(r.status,200);for(const line of body.split("\n")){try{const v=JSON.parse(line.slice(line.indexOf(":")+1));if(typeof v?.ok==="boolean")return v;}catch{}}throw new Error(`Missing result for ${name}`);}
const suffix=randomBytes(6).toString("hex"),email=`portal-${suffix}@verbo.local`,teacher=`teacher-${suffix}@verbo.local`,password=randomBytes(18).toString("base64url");
let studentId:string|undefined;let otherId:string|undefined;
async function main() {
try {
  const access=JSON.parse(await readFile(".local/access.json","utf8"));
  assert.equal((await login(access.admin.email,access.admin.password)).user.role,"ADMIN");
  for(const path of ["/admin","/admin/accesos","/admin/correos","/admin/alumnos"])assert.equal((await request(path)).status,200,path);
  assert.equal((await action("createStudent",[{fullName:"Verificación de portal",email,password,teacherEmail:teacher}])).ok,true);
  const student=await db.student.findUniqueOrThrow({where:{email}});studentId=student.id;assert.equal(student.teacherEmail,teacher);
  assert.equal(await db.emailDelivery.count({where:{recipient:email}}),1);
  const [exam,other]=await Promise.all([db.examType.findFirstOrThrow({where:{slug:"toefl-ibt"},include:{examVersions:{where:{isPublished:true}}}}),db.examType.findFirstOrThrow({where:{slug:"det"},include:{examVersions:{where:{isPublished:true}}}})]);
  assert.equal((await action("createEnrollment",[{studentId,examTypeId:exam.id,attemptsAllowed:2,unlockedVersions:[other.examVersions[0].id]}])).ok,false,"foreign versions rejected");
  assert.equal((await action("createEnrollment",[{studentId,examTypeId:exam.id,attemptsAllowed:2.5}])).ok,false,"fractional limit rejected");
  assert.equal((await action("createEnrollment",[{studentId,examTypeId:exam.id,attemptsAllowed:2,unlockedVersions:[exam.examVersions[0].id]}])).ok,true);
  const enrollment=await db.enrollment.findUniqueOrThrow({where:{studentId_examTypeId:{studentId:student.id,examTypeId:exam.id}}});
  assert.deepEqual(enrollment.unlockedVersions,[exam.examVersions[0].id]);
  await db.enrollment.update({where:{id:enrollment.id},data:{attemptsUsed:1}});
  assert.equal((await action("updateEnrollment",[enrollment.id,{attemptsAllowed:0}])).ok,false);
  assert.equal((await action("updateEnrollment",[enrollment.id,{unlockedVersions:[other.examVersions[0].id]}])).ok,false);
  assert.equal((await action("updateEnrollment",[enrollment.id,{isBlocked:true}])).ok,true);
  assert.equal((await db.enrollment.findUniqueOrThrow({where:{id:enrollment.id}})).isBlocked,true);
  assert.equal((await action("regenerateAccessCode",[enrollment.id])).ok,true);
  assert.notEqual((await db.enrollment.findUniqueOrThrow({where:{id:enrollment.id}})).accessCode,enrollment.accessCode);
  const attempt=await db.attempt.create({data:{studentId,examVersionId:exam.examVersions[0].id,status:"COMPLETED",completedAt:new Date(),overallScore:{scoringVersion:"verbo-toefl-practice-v1",value:4.5},subscores:{Reading:4,Listening:5,Writing:4,Speaking:5}}});
  assert.equal((await login(email,password)).user.id,studentId);
  const resultHtml=await(await request(`/alumno/resultado/${attempt.id}`)).text();assert.match(resultHtml,/CONSTANCIA DE SIMULACIÓN/);assert.match(resultHtml,/4\.5/);assert.match(resultHtml,/Imprimir o guardar PDF/);
  const restricted=await request("/admin/correos");assert.ok([302,307].includes(restricted.status),"student cannot read mail log");
  const otherStudent=await db.student.create({data:{fullName:"Otro alumno temporal",email:`other-${email}`,passwordHash:await bcrypt.hash(password,10)}});otherId=otherStudent.id;
  await login(otherStudent.email,password);assert.equal((await request(`/alumno/resultado/${attempt.id}`)).status,404,"certificate stays private");
  await login(access.admin.email,access.admin.password);assert.equal((await action("updateStudent",[studentId,{fullName:student.fullName,email,teacherEmail:teacher,isActive:false}])).ok,true);
  const disabled=await login(email,password);assert.equal(disabled.user,undefined,"suspended account cannot log in");
  await db.student.update({where:{id:studentId},data:{isActive:true}});await login(email,password);
  await db.student.update({where:{id:studentId},data:{passwordHash:await bcrypt.hash(randomBytes(18).toString("hex"),10)}});assert.equal((await(await request("/api/auth/session")).json())?.user,undefined,"password reset invalidates old sessions");
  await login(access.admin.email,access.admin.password);assert.equal((await action("deleteEnrollment",[enrollment.id])).ok,true);assert.equal(await db.attempt.count({where:{studentId}}),1,"revocation preserves results");
  console.log(JSON.stringify({passed:["admin pages","student creation and welcome queue","teacher assignment","foreign versions rejected","integer attempt limits","explicit version assignment","block and rotate code","private certificate","student role isolation","account suspension","password session invalidation","access revocation preserves results"]},null,2));
}finally{
  await db.emailDelivery.deleteMany({where:{recipient:{in:[email,teacher]}}});
  if(studentId)await db.student.delete({where:{id:studentId}});if(otherId)await db.student.delete({where:{id:otherId}});await db.$disconnect();
}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
