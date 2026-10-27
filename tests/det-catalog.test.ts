import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { detForms, detForm } from "../content/det-2026/forms";
import { detMetadata, detPoints, detSolutionAnswer, detPublicPrompt } from "../src/lib/det-format";
import { advanceRuntime, beginSpokenResponse, createRuntime, type TimedQuestion } from "../src/lib/attempt-runtime";

test("DET catalog contains a full diagnostic and three independent forms with isolated audio paths",()=>{
  assert.equal(detForms.length,4);assert.equal(detForm("diagnostic").hasFeedback,false);
  assert.throws(()=>detForm("unknown"));
  const texts=new Set<string>(),audio=new Set<string>();
  for(const form of detForms){
    assert.equal(form.questions.length,134);assert.equal(form.audioScripts.length,36);
    for(const q of form.questions){
      const m=detMetadata(q.prompt)!;assert.ok(m,q.key);
      // Photo prompts and fixed UI instructions deliberately share wording.
      if(typeof q.prompt.text==="string"&&!["summary"].includes(m.task)){
        assert.ok(!texts.has(q.prompt.text),`${form.label}: repeated ${q.key}`);texts.add(q.prompt.text);
      }
      if(q.answer){const p=detPoints(q.prompt,q.answer,detSolutionAnswer(q.answer));assert.equal(p.earned,p.possible,`${form.id}/${q.key}`);assert.ok(p.possible>0);}
      const projected=JSON.stringify(detPublicPrompt(q.prompt));assert.ok(!projected.includes("_transcript"));assert.ok(!projected.includes("_det"));
    }
    for(const clip of form.audioScripts){assert.ok(!audio.has(clip.id));audio.add(clip.id);}
  }
});
for(const form of detForms)for(const lower of [false,true])test(`${form.label}: complete ${lower?"lower":"upper"} route has all current tasks, preparation and 72 screens`,()=>{
  const timed:TimedQuestion[]=form.questions.map(q=>{const m=detMetadata(q.prompt)!;return {id:q.key,sectionId:"det",timingMode:m.group?"PER_SECTION":"PER_QUESTION",timePerItemSeconds:m.seconds,prepTimeSeconds:0,sectionDurationMinutes:60,det:m,requiresStimulus:m.task==="interview",timingGroup:m.group?{key:m.group.key,durationSeconds:m.group.seconds}:undefined,possiblePoints:detPoints(q.prompt,q.answer).possible};});
  let now=1000,state=createRuntime(timed,now,60);const visited=new Set<string>(),earned:Record<string,number>={};const tasks:Record<string,number>={};
  while(!state.finished){const q=timed[state.index];assert.ok(!visited.has(q.id));visited.add(q.id);tasks[q.det!.task]=(tasks[q.det!.task]??0)+1;if(state.phase!=="answer")state=beginSpokenResponse(state,timed,++now);earned[q.id]=lower?0:q.possiblePoints??0;state=advanceRuntime(state,timed,++now,earned);}
  assert.equal(visited.size,72);assert.equal(Object.keys(state.detSelections).length,31);assert.equal(tasks.word,16);assert.equal(tasks.dictation,6);assert.equal(tasks.highlight,4);assert.equal(tasks["listen-respond"],10);assert.equal(tasks.interview,6);assert.equal(tasks.writing,2);assert.equal(tasks["writing-sample"],1);assert.equal(tasks["speaking-sample"],1);
  assert.equal(timed.find(q=>q.id===state.detSelections["word-2"])?.det?.level,lower?1:5);
});
test("Every catalog audio file matches its script fingerprint, voice and manifest",()=>{
  const manifest=JSON.parse(readFileSync("public/audio/det-2026/manifest.json","utf8")) as {clips:{path:string;textSha256:string;sha256:string;voice:string}[]};
  for(const form of detForms)for(const script of form.audioScripts){
    const clip=manifest.clips.find(c=>c.path===`/audio/det-2026/${script.id}.wav`);assert.ok(clip,script.id);
    assert.equal(clip.textSha256,createHash("sha256").update(script.text).digest("hex"));
    const bytes=readFileSync(`public${clip.path}`);assert.equal(bytes.toString("ascii",8,12),"WAVE");assert.equal(clip.sha256,createHash("sha256").update(bytes).digest("hex"));
    assert.equal(clip.voice,script.speaker?"en_GB-vctk-medium.onnx":"en_US-libritts_r-medium.onnx");
  }
});
