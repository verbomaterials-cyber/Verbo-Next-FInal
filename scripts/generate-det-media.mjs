import { mkdir, readFile, writeFile, copyFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import path from "node:path";
import { detForms } from "../content/det-2026/forms.ts";
const audioScripts=detForms.flatMap(form=>form.audioScripts);
const previous=await readFile("public/audio/det-2026/manifest.json","utf8").then(JSON.parse).catch(()=>({clips:[]}));
await mkdir("public/audio/det-2026",{recursive:true});
await mkdir("public/images/det-2026",{recursive:true});
const engine=path.resolve(".local/voice-tools/piper/piper/piper.exe");
const models=["en_US-libritts_r-medium.onnx","en_GB-vctk-medium.onnx"];
for(const speaker of [0,1]) {
  const jobs=[];
  for(const script of audioScripts.filter(a=>a.speaker===speaker)) {
    const output=path.resolve(`public/audio/det-2026/${script.id}.wav`);
    const textSha256=createHash("sha256").update(script.text).digest("hex");
    const prior=previous.clips.find(c=>c.path===`/audio/det-2026/${script.id}.wav`);
    try{if((await readFile(output)).length>1000&&prior&&prior.voice===models[speaker]&&(!prior.textSha256||prior.textSha256===textSha256))continue;}catch{}
    await mkdir(path.dirname(output),{recursive:true});
    jobs.push({text:script.text,speaker_id:0,output_file:output});
  }
  if(!jobs.length)continue;
  await new Promise((resolve,reject)=>{
    const child=spawn(engine,["--model",path.resolve(`.local/voices/${models[speaker]}`),"--json-input","--length_scale","1.35","--sentence_silence","0.12","--quiet"],{cwd:path.dirname(engine),windowsHide:true,stdio:["pipe","ignore","pipe"]});
    let errors="";child.stderr.on("data",b=>errors=(errors+b.toString()).slice(-2000));child.on("error",reject);child.on("exit",code=>code===0?resolve():reject(new Error(errors)));child.stdin.on("error",reject);child.stdin.end(jobs.map(j=>JSON.stringify(j)).join("\n")+"\n");
  });
  console.log(`Audio DET: ${jobs.length} archivos con ${speaker?"voz británica":"voz estadounidense"}.`);
}
const clips=[];
for(const script of audioScripts) {
  const bytes=await readFile(`public/audio/det-2026/${script.id}.wav`);
  if(bytes.toString("ascii",0,4)!=="RIFF"||bytes.toString("ascii",8,12)!=="WAVE")throw new Error(`WAV inválido: ${script.id}`);
  clips.push({path:`/audio/det-2026/${script.id}.wav`,voice:models[script.speaker],speakerId:0,textSha256:createHash("sha256").update(script.text).digest("hex"),sha256:createHash("sha256").update(bytes).digest("hex")});
}
await copyFile("public/audio/toefl-2026/VOICE-CREDITS.md","public/audio/det-2026/VOICE-CREDITS.md");
await writeFile("public/audio/det-2026/manifest.json",JSON.stringify({engine:"Piper 2023.11.14-2",synthesis:"offline",lengthScale:1.35,credits:"/creditos-audio",clips},null,2));
const photos=[
  {name:"market",author:"Karel Mistrík",source:"https://unsplash.com/photos/a-person-selling-fruits-at-an-outdoor-market-52gZQu4zwrM",image:"https://images.unsplash.com/photo-1660680298766-935033b988c6?fm=jpg&w=1200&q=85&fit=max"},
  {name:"library",author:"Caroline Andrade Rocha",source:"https://unsplash.com/photos/two-people-studying-in-a-quiet-sunlit-space-z_dLp6KnCoQ",image:"https://images.unsplash.com/photo-1752747115265-1e4cfb2c1212?fm=jpg&w=1200&q=85&fit=max"},
  {name:"bicycle",author:"Anton Savinov",source:"https://unsplash.com/photos/a-person-fixing-a-bicycle-JcYh9G4sJPs",image:"https://images.unsplash.com/photo-1668594864261-dcb0eaa3644b?fm=jpg&w=1200&q=85&fit=max"},
  {name:"park",author:"Kelly Sikkema",source:"https://unsplash.com/photos/people-walking-on-park-during-daytime-eSQNlt0QmXI",image:"https://images.unsplash.com/photo-1622050956578-94fd044a0ada?fm=jpg&w=1200&q=85&fit=max"},
];
for(const photo of photos) {
  const target=`public/images/det-2026/${photo.name}.jpg`;
  let bytes;try{bytes=await readFile(target);}catch{}
  if(!bytes){const response=await fetch(photo.image);if(!response.ok)throw new Error(`Foto ${photo.name}: ${response.status}`);bytes=Buffer.from(await response.arrayBuffer());if(bytes[0]!==255||bytes[1]!==216)throw new Error("Se esperaba un archivo JPEG.");await writeFile(target,bytes);}
  photo.sha256=createHash("sha256").update(bytes).digest("hex");
}
await writeFile("public/images/det-2026/credits.json",JSON.stringify({license:"https://unsplash.com/license",modifications:"Downscaled for local exam display; no subject alterations.",photos},null,2));
console.log(`${clips.length} audios y cuatro fotografías listos para uso local.`);
