import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { questions, audioScripts, DET_DELIVERED_SCREENS } from "../content/det-2026/index";
import { detForms } from "../content/det-2026/forms";
import { detMetadata, detPoints, detPublicPrompt, detSolutionAnswer, DET_FORMAT, detDelivered } from "../src/lib/det-format";
import { advanceRuntime, beginSpokenResponse, createRuntime, readRuntime, type TimedQuestion } from "../src/lib/attempt-runtime";
const timed:TimedQuestion[]=questions.map(q=>{const m=detMetadata(q.prompt)!;return{id:q.key,sectionId:"det",timingMode:m.group?"PER_SECTION":"PER_QUESTION",timePerItemSeconds:m.seconds,prepTimeSeconds:0,sectionDurationMinutes:60,det:m,requiresStimulus:m.task==="interview",timingGroup:m.group?{key:m.group.key,durationSeconds:m.group.seconds}:undefined,possiblePoints:detPoints(q.prompt,q.answer).possible};});
test("DET catalog covers current frequencies, both interactive sets, all thirteen groups and scored samples",()=>{
  assert.equal(DET_DELIVERED_SCREENS,DET_FORMAT.practiceScreens);assert.equal(new Set(questions.map(q=>q.key)).size,questions.length);
  const delivered=questions.filter(q=>!detMetadata(q.prompt)?.slot||detMetadata(q.prompt)?.level===3);
  const count=(task:string)=>delivered.filter(q=>detMetadata(q.prompt)?.task===task).length;
  assert.equal(count("word"),16);assert.equal(count("dictation"),6);assert.equal(delivered.filter(q=>q.type==="Fill in the Blanks").length,6);assert.equal(delivered.filter(q=>q.type==="Read and Complete").length,3);
  assert.equal(delivered.filter(q=>q.type.startsWith("Interactive Reading:")).length,12);assert.equal(count("listen-complete"),2);assert.equal(count("listen-respond"),10);assert.equal(count("summary"),2);assert.equal(count("interview"),6);assert.equal(count("photo-write"),3);assert.equal(count("writing"),2);
  assert.ok(questions.every(q=>!['Read Aloud','Listen, Then Speak','Listen and Select'].includes(q.type)));
  assert.equal(count("writing-sample"),1);assert.equal(count("speaking-sample"),1);
});
test("DET answer keys award full credit, partial dictation/highlight credit and no credit for missing answers",()=>{
  for(const q of questions){assert.ok(detMetadata(q.prompt),q.key);if(!q.answer)continue;const p=detPoints(q.prompt,q.answer,detSolutionAnswer(q.answer));assert.ok(p.possible>0,q.key);assert.equal(p.earned,p.possible,q.key);assert.equal(detPoints(q.prompt,q.answer,{}).earned,0,q.key);}
  const q=questions.find(q=>q.type==="Listen and Type")!;const p=detPoints(q.prompt,q.answer,{text:String(q.answer!.transcript).split(" ").slice(1).join(" ")});assert.ok(p.earned>0&&p.earned<1);
  const highlight=questions.find(q=>detMetadata(q.prompt)?.task==="highlight")!;const key=highlight.answer as {start:number;end:number};assert.ok(detPoints(highlight.prompt,key,{start:key.start,end:key.end+1}).earned<1);
  assert.equal(detPoints(highlight.prompt,key,{start:-1,end:500}).earned,0);
});
for(const performance of ["correct","wrong"] as const)test(`DET ${performance}: server selection changes difficulty, delivers 72 unique screens and preserves its choice on reload`,()=>{
  let state=createRuntime(timed,1000,60),now=1001;const earned:Record<string,number>={},visited=new Set<string>();
  while(!state.finished){const q=timed[state.index];assert.ok(!visited.has(q.id));visited.add(q.id);if(state.phase!=="answer")state=beginSpokenResponse(state,timed,now++);earned[q.id]=performance==="correct"?(q.possiblePoints??0):0;state=advanceRuntime(state,timed,now++,earned);assert.deepEqual(readRuntime(state,timed),state);}
  assert.equal(visited.size,72);assert.equal(Object.keys(state.detSelections).length,31);
  const second=timed.find(q=>q.id===state.detSelections["word-2"])!;assert.equal(second.det?.level,performance==="correct"?5:1);
  assert.equal(questions.filter(q=>detDelivered(detMetadata(q.prompt),q.key,state.detSelections)).length,72);
});
test("DET reading/listening share persistent clocks; expiration skips remaining group but opens its summary",()=>{
  let state=createRuntime(timed,1000,60),now=1001;
  while(timed[state.index].det?.set!=="listening-1")state=advanceRuntime(state,timed,now++);
  const deadline=state.deadlineAt;state=advanceRuntime(state,timed,now++);assert.equal(state.deadlineAt,deadline);
  state=advanceRuntime(state,timed,deadline+1);assert.equal(timed[state.index].det?.task,"summary");assert.equal(state.totalSeconds,75);
});
test("DET preparation and stimulus have separate response clocks, without granting more time after reload",()=>{
  const photo=timed.find(q=>q.det?.task==="photo-speak")!;let state=createRuntime([photo],1000,60);assert.equal(state.phase,"prep");assert.equal(state.deadlineAt,21000);
  state=beginSpokenResponse(state,[photo],31000);assert.equal(state.deadlineAt,111000);assert.equal(state.phase,"answer");assert.equal(beginSpokenResponse(state,[photo],50000).deadlineAt,111000);
  const spoken=timed.find(q=>q.det?.task==="interview")!;state=createRuntime([spoken],1000,60);assert.equal(state.phase,"stimulus");state=beginSpokenResponse(state,[spoken],5000);assert.equal(state.deadlineAt,40000);
});
test("DET public projection hides spelling keys, transcripts, metadata and arbitrary nested solutions",()=>{
  const p=detPublicPrompt({text:"The w[indow] is open.",_det:{secret:true},_transcript:"private",correctAnswer:"private",options:{options:["one","two"],correct:1},blanks:[{text:"a",options:["b"],correct:0,secret:"answer"}]});
  assert.equal(p.text,"The w[_____] is open.");assert.ok(!JSON.stringify(p).includes("private"));assert.ok(!JSON.stringify(p).includes("correct"));assert.ok(!JSON.stringify(p).includes("secret"));
});
test("DET has real, attributed local photos and speech WAV files matching its audio manifest",()=>{
  const manifest=JSON.parse(readFileSync("public/audio/det-2026/manifest.json","utf8"));assert.equal(manifest.clips.length,detForms.reduce((n,f)=>n+f.audioScripts.length,0));assert.equal(audioScripts.length,36);
  for(const clip of manifest.clips){const bytes=readFileSync(`public${clip.path}`);assert.ok(bytes.length>1000);assert.equal(bytes.toString("ascii",0,4),"RIFF");assert.equal(createHash("sha256").update(bytes).digest("hex"),clip.sha256);}
  const credits=JSON.parse(readFileSync("public/images/det-2026/credits.json","utf8"));assert.equal(credits.photos.length,4);
  for(const p of credits.photos){const bytes=readFileSync(`public/images/det-2026/${p.name}.jpg`);assert.equal(bytes[0],255);assert.equal(bytes[1],216);assert.equal(createHash("sha256").update(bytes).digest("hex"),p.sha256);}
});
