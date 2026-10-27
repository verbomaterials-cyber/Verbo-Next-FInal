// Offline asset build; never modifies source WAVs or database content.
// Usage: node scripts/optimize-audio.mjs <ffmpeg-executable>
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
const ffmpeg = process.argv[2];
if (!ffmpeg) throw new Error('Supply the ffmpeg executable.');
const files=[];
async function walk(dir){for(const e of await fs.readdir(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory()&&e.name!=='optimized')await walk(p);else if(e.isFile()&&p.endsWith('.wav'))files.push(p);}}
await walk('public/audio');
await fs.mkdir('public/audio/optimized',{recursive:true});
await fs.mkdir('src/generated',{recursive:true});
const manifest={};let sourceBytes=0,optimizedBytes=0;
for(const file of files.sort()){
  const temp='public/audio/optimized/build.mp3';
  const result=spawnSync(ffmpeg,['-hide_banner','-loglevel','error','-nostdin','-y','-i',file,'-vn','-ac','1','-codec:a','libmp3lame','-b:a','96k','-map_metadata','-1',temp],{encoding:'utf8',windowsHide:true});
  if(result.status!==0)throw new Error(`${file}: ${result.stderr}`);
  const output=await fs.readFile(temp), input=await fs.readFile(file);
  // Skip any asset that doesn't become smaller.
  if(output.length>=input.length)continue;
  const name=createHash('sha256').update(output).digest('hex').slice(0,24)+'.mp3';
  await fs.writeFile(path.join('public/audio/optimized',name),output);
  manifest['/'+file.replaceAll('\\','/').replace(/^public\//,'')]='/audio/optimized/'+name;
  sourceBytes+=input.length;optimizedBytes+=output.length;
}
await fs.unlink('public/audio/optimized/build.mp3');
await fs.writeFile('src/generated/audio-manifest.json',JSON.stringify(manifest,null,2)+'\n');
const report={files:Object.keys(manifest).length,sourceBytes,optimizedBytes,reductionPercent:Math.round((1-optimizedBytes/sourceBytes)*100)};
await fs.writeFile('.local/deploy/audio-optimization.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report));
