import {test} from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {createHash} from "node:crypto";
import manifest from "../src/generated/audio-manifest.json";
import {optimizedMedia} from "../src/lib/media";

test("optimized audio URLs match their bytes, remain local and reduce transfer",()=>{
  let before=0,after=0;
  for(const [source,target] of Object.entries(manifest)){
    assert.match(source,/^\/audio\/.+\.wav$/);
    assert.match(target,/^\/audio\/optimized\/[a-f0-9]{24}\.mp3$/);
    const original=fs.readFileSync(`public${source}`),encoded=fs.readFileSync(`public${target}`);
    assert.ok(encoded.length<original.length);
    assert.equal(target.split("/").at(-1),createHash("sha256").update(encoded).digest("hex").slice(0,24)+".mp3");
    before+=original.length;after+=encoded.length;
  }
  assert.ok(Object.keys(manifest).length>=300);
  assert.ok(after/before<0.3);
});
test("nested stimulus URLs are optimized without changing text, keys or external URLs",()=>{
  const [source,target]=Object.entries(manifest)[0];
  const original={audioUrl:source,_det:{scenarioAudio:source},text:`Listen to ${source}`,external:"https://example.com/audio.wav",options:["a","b"],answer:0};
  const result=optimizedMedia(original);
  assert.equal(result.audioUrl,target);assert.equal(result._det.scenarioAudio,target);
  assert.equal(result.text,original.text);assert.equal(result.external,original.external);
  assert.deepEqual(result.options,original.options);assert.equal(result.answer,0);
  assert.equal(original.audioUrl,source);
});
