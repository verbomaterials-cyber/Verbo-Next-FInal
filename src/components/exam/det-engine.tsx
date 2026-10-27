"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { beginSpeaking, completeAttempt, markAudioPlayed, navigateAttempt, saveResponse } from "@/lib/student/actions";
import { remainingSeconds, type RuntimeView } from "@/lib/attempt-runtime";
import type { DetMeta } from "@/lib/det-format";
import { AudioRecorder } from "./audio-recorder";
import { formatTime } from "./exam-timer";
import "./det.css";

export type DetScreen = { id:string; name:string; prompt:Record<string,unknown>; meta:DetMeta; answer:Record<string,unknown>;
  previousText?:string; history?:{speaker:string;text:string}[]; progress:number; total:number };
const control="det-control";
export function DetEngine({attemptId,screen,initialRuntime,preview=false}:{attemptId:string;screen:DetScreen;initialRuntime:RuntimeView;preview?:boolean}) {
  const router=useRouter();
  const [runtime,setRuntime]=useState(initialRuntime), [answer,setAnswer]=useState(screen.answer), [now,setNow]=useState(initialRuntime.serverNow);
  const [busy,setBusy]=useState(false),[mediaBusy,setMediaBusy]=useState(false),[error,setError]=useState<string|null>(null),[saving,setSaving]=useState(false);
  const [recording,setRecording]=useState(false);
  const stopRecordingRef=useRef<(()=>void)|null>(null),submitRecordingRef=useRef(false);
  const recordingControl=useCallback((stop:(()=>void)|null)=>{stopRecordingRef.current=stop;setRecording(!!stop);},[]);
  const navRef=useRef(false), offset=useRef(0), expiredRef=useRef<string|null>(null);
  const seconds=remainingSeconds(runtime.deadlineAt,now), expired=seconds===0, meta=screen.meta,prompt=screen.prompt;
  const audioPlays=runtime.audioPlays?.[screen.id] ?? 0;
  const change=useCallback((value:Record<string,unknown>)=>setAnswer(value),[]);
  useEffect(()=>{offset.current=initialRuntime.serverNow-Date.now();const timer=setInterval(()=>setNow(Date.now()+offset.current),250);return()=>clearInterval(timer);},[initialRuntime.serverNow]);
  const beginAnswer=useCallback(async()=>{
    if(preview){offset.current=0;setNow(Date.now());setRuntime(r=>({...r,phase:"answer",deadlineAt:Date.now()+meta.seconds*1000,totalSeconds:meta.seconds}));return;}
    const result=await beginSpeaking({attemptId,questionId:screen.id});
    if(!result.ok || !result.data){setError(result.ok?"No se pudo iniciar la respuesta.":result.error);return;}
    offset.current=result.data.serverNow-Date.now();setRuntime(result.data);setNow(result.data.serverNow);setError(null);
  },[attemptId,screen.id,meta.seconds,preview]);
  const navigate=useCallback(async(value:Record<string,unknown>=answer)=>{
    if(navRef.current || mediaBusy)return;
    if(preview){setError("Vista de desarrollo: no guarda ni consume intentos.");return;}
    navRef.current=true;setBusy(true);
    try {
      const result=await navigateAttempt({attemptId,questionId:screen.id,answerContent:value,isFlagged:false,direction:"next"});
      if(!result.ok || !result.data){setError(result.ok?"No se recibió el avance.":result.error);return;}
      if(result.data.finished){const final=await completeAttempt({attemptId});if(!final.ok){setError(final.error);setRuntime(result.data);return;}router.push(`/alumno/resultado/${attemptId}`);}
      else router.refresh();
    }catch{setError("No se pudo guardar. Conservamos tu respuesta en esta pantalla; reintenta.");}
    finally{navRef.current=false;setBusy(false);}
  },[attemptId,screen.id,answer,mediaBusy,router,preview]);
  useEffect(()=>{
    if(!expired || busy || mediaBusy || preview)return;
    const key=`${screen.id}:${runtime.phase}:${runtime.deadlineAt}`;
    if(expiredRef.current===key)return;
    const timer=setTimeout(()=>{expiredRef.current=key;void(runtime.phase==="prep"?beginAnswer():navigate());},0);
    return()=>clearTimeout(timer);
  },[expired,busy,mediaBusy,screen.id,runtime.phase,runtime.deadlineAt,beginAnswer,navigate,preview]);
  useEffect(()=>{
    if(preview || runtime.phase!=="answer" || busy || expired || !Object.keys(answer).length)return;
    const timer=setTimeout(async()=>{
      setSaving(true);
      try{const result=await saveResponse({attemptId,questionId:screen.id,answerContent:answer,isFlagged:false});if(!result.ok)setError(result.error);else setError(null);}
      catch{setError("Sin conexión. Tu respuesta sigue aquí; reintenta antes de cerrar.");}finally{setSaving(false);}
    },700);return()=>clearTimeout(timer);
  },[answer,attemptId,screen.id,runtime.phase,busy,expired,preview]);
  async function audioStarted(){
    if(!preview){const result=await markAudioPlayed({attemptId,questionId:screen.id});if(!result.ok)throw new Error(result.error);}
    setRuntime(r=>({...r,audioPlays:{...r.audioPlays,[screen.id]:(r.audioPlays?.[screen.id]??0)+1}}));
  }
  const spoken=["photo-speak","read-speak","interview","speaking-sample"].includes(meta.task);
  const ready=runtime.phase==="answer";
  const hasAnswer=spoken?answer.recorded===true || answer.recorded===false:meta.task==="highlight"?Number.isInteger(answer.start):meta.task==="word" || meta.task==="choice" || meta.task==="reading-sentence" || meta.task==="listen-respond"?typeof answer.options==="number":meta.task==="reading-words"?Array.isArray(answer.choices)&&(prompt.blanks as unknown[]).every((_,i)=>Number.isInteger((answer.choices as unknown[])[i])):meta.task==="letters"||meta.task==="listen-complete"?Array.isArray(answer.answers)&&(answer.answers as string[]).some(v=>v.trim()):typeof answer.text==="string"&&!!answer.text.trim();
  useEffect(()=>{
    if(mediaBusy||!submitRecordingRef.current||!hasAnswer)return;
    const timer=setTimeout(()=>{submitRecordingRef.current=false;void navigate();},0);
    return()=>clearTimeout(timer);
  },[mediaBusy,hasAnswer,navigate]);
  const isPhoto=typeof prompt.imageUrl==="string", hasPassage=typeof prompt.passage==="string";
  return <div className={`det-exam fixed inset-0 z-40 overflow-y-auto ${preview?"det-preview":""}`} data-task={meta.task}>
    <div className="det-frame">
      <header className="det-header">
        <div className={`det-clock ${seconds<=10?"det-clock-warning":""}`}><svg aria-hidden="true" width="27" height="31" viewBox="0 0 28 32" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="14" cy="18" r="11"/><path d="M10 2h8M14 2v5m0 11 5-5"/><circle cx="14" cy="18" r="1"/></svg><div role="timer" aria-label="Time remaining" className="det-time">{formatTime(seconds)}</div><span className="det-clock-caption">{runtime.phase==="prep"?"to prepare":runtime.phase==="stimulus"?"to listen":meta.group?`for ${Math.max(1,(meta.set?.startsWith("reading")?6:6)-(meta.step??1)+1)} questions`:spoken?"to speak":["writing","writing-sample","photo-write","summary"].includes(meta.task)?"to write":""}</span></div>
        <span className="det-practice-label">VERBO · DET practice</span>
      </header>
      <div className="sr-only" aria-label="Test progress" role="progressbar" aria-valuenow={screen.progress} aria-valuemin={0} aria-valuemax={screen.total}/>
      <main className="det-main">
        <p className="sr-only">{screen.name}{meta.step?` · ${meta.step}`:""}</p>
        {!hasPassage&&meta.task!=="writing"&&<h1 className="det-instruction">{String(prompt.instruction)}</h1>}
        {runtime.phase==="prep"&&<p className="det-preparation" role="status">Read and prepare. Your response time begins after this countdown.</p>}
        <fieldset aria-label={screen.name} disabled={busy || (expired && !mediaBusy) || runtime.finished} className={`det-content ${hasPassage?"det-reading":isPhoto?"det-photo":meta.task==="writing"?"det-writing":"det-single"} ${meta.task==="reading-words"?"det-reading-cloze":""}`}>
          {meta.task==="writing"&&<WritingSteps step={meta.step??1} prompt={String(prompt.text)} previous={screen.previousText??""} answer={answer} ready={ready} onChange={change}/>}
          {isPhoto&&<div className="det-photograph">{/* Real bundled photographs retain their original aspect ratio. */}
            <Image unoptimized src={String(prompt.imageUrl)} width={1200} height={900} alt={String(prompt.imageAlt??"Practice photograph")} className="h-auto max-h-[430px] w-full object-contain"/>
          </div>}
          {hasPassage&&<div className="det-passage" tabIndex={0} aria-label="Passage">
            <p className="det-eyebrow">PASSAGE</p>
            {meta.task==="reading-words"&&<h1 className="mb-4 text-xl font-semibold">{String(prompt.instruction)}</h1>}
            {typeof prompt.title==="string"&&<h2 className="mb-4 text-base font-semibold">{prompt.title}</h2>}
            {meta.task==="reading-words"?<ReadingCloze passage={String(prompt.passage)} blanks={prompt.blanks as {options:string[]}[]} value={answer} onChange={change}/>:meta.task==="highlight"?<Highlight passage={String(prompt.passage)} value={answer} onChange={change}/>:<p className="whitespace-pre-wrap">{meta.task==="reading-sentence"&&typeof answer.options==="number"?String(prompt.passage).replace("[ … ]",(prompt.options as {options:string[]}).options[answer.options]):String(prompt.passage)}</p>}
          </div>}
          {meta.task!=="writing"&&<div className={`det-response min-w-0 space-y-5 ${meta.task==="reading-words"?"hidden":""}`}>
            {hasPassage&&meta.task!=="reading-words"&&<h1 className="text-xl leading-relaxed font-semibold">{String(prompt.instruction)}</h1>}
            {meta.task==="word"?<div className="det-word"><p>{String(prompt.text)}</p><div className="det-word-actions">{["Yes","No"].map((text,i)=><button key={text} type="button" disabled={!ready} onClick={()=>{const value={options:i};change(value);void navigate(value);}} className="det-choice-button"><span aria-hidden="true">{i===0?"✓":"×"}</span>{text.toUpperCase()}</button>)}</div></div>:
             meta.task==="letters"?<LetterBlanks text={String(prompt.text)} value={answer} onChange={change}/>:
             <>
              {meta.scenarioAudio&&meta.task==="listen-respond"&&<details className="rounded-lg border border-[#dce2e6] p-3 text-sm"><summary className="cursor-pointer">Listen to the scenario again</summary><audio src={meta.scenarioAudio} controls className="mt-3 w-full" aria-label="Scenario audio"/></details>}
              {screen.history&&screen.history.length>0&&<div className="max-h-48 space-y-3 overflow-y-auto rounded-xl bg-[#eef2f4] p-4 text-sm leading-relaxed" aria-label="Conversation so far">{screen.history.map((turn,i)=><p key={i}><b>{turn.speaker}: </b>{turn.text}</p>)}</div>}
              {typeof prompt.audioUrl==="string"&&<DetAudio key={screen.id} src={prompt.audioUrl} plays={audioPlays} limit={meta.task==="dictation"?3:meta.task==="listen-complete"?Infinity:1} onStarted={audioStarted} onEnded={meta.task==="interview"?beginAnswer:undefined} onError={setError}/>}
              {meta.task==="interview"&&<div className="det-partner"><svg viewBox="0 0 120 120" width="160" height="160" role="img" aria-label="Practice conversation partner"><circle cx="60" cy="60" r="58" fill="#e4f3fc"/><path d="M22 110c0-35 76-35 76 0" fill="#168aca"/><ellipse cx="60" cy="53" rx="27" ry="32" fill="#d49a72"/><path d="M33 47c-7-40 64-45 55 9-6-10-15-12-22-24-10 15-19 15-33 15" fill="#3c3037"/><g className="det-partner-eyes"><circle cx="49" cy="55" r="2.5"/><circle cx="71" cy="55" r="2.5"/></g><path d="M49 70q11 9 22 0" stroke="#6f3d35" strokeWidth="3" fill="none"/></svg><p className="mt-3 text-sm text-[#777]">Your conversation partner</p></div>}
              {typeof prompt.text==="string"&&<p className="text-lg leading-relaxed whitespace-pre-wrap">{prompt.text}</p>}
              {screen.previousText!==undefined&&<details open className="rounded-lg bg-[#eef2f4] p-4 text-sm"><summary className="cursor-pointer font-medium">Your previous response</summary><p className="mt-3 whitespace-pre-wrap leading-relaxed">{screen.previousText||"No response submitted."}</p></details>}
              {meta.task==="highlight"&&<><div className="det-highlight-answer" role="status" aria-label="Selected answer">{Number.isInteger(answer.start)?String(prompt.passage).split(/\s+/).slice(Number(answer.start),Number(answer.end)+1).join(" "):"Click and drag to highlight text"}</div><p className="det-keyboard-help">Keyboard: select the first word with Enter, then the last with Shift + Enter.</p></>}
              {meta.task==="reading-words"&&(prompt.blanks as {text:string;options:string[]}[]).map((blank,i)=><label key={i} className="block text-sm leading-relaxed">{blank.text.split("___")[0]}<select aria-label={`Missing word ${i+1}`} value={(answer.choices as number[]|undefined)?.[i]??""} onChange={e=>{const choices=[...((answer.choices as unknown[])??[])];choices[i]=Number(e.target.value);change({choices});}} className={`${control} mx-1 py-2`}><option value="" disabled>select</option>{blank.options.map((option,n)=><option key={n} value={n}>{option}</option>)}</select>{blank.text.split("___")[1]}</label>)}
              {meta.task==="listen-complete"&&(prompt.blanks as {text:string}[]).map((blank,i)=><label key={i} className="block text-sm leading-relaxed">{blank.text.split("___")[0]}<input aria-label={`Answer ${i+1}`} autoComplete="off" spellCheck={false} value={(answer.answers as string[]|undefined)?.[i]??""} maxLength={160} onChange={e=>{const answers=[...((answer.answers as string[])??[])];answers[i]=e.target.value;change({answers});}} className={`${control} mx-1 mt-2 w-full sm:w-56`}/>{blank.text.split("___")[1]}</label>)}
              {prompt.options&&<div className="det-options" role="radiogroup" aria-label="Response options">{(prompt.options as {options:string[]}).options.map((option,i)=><label key={i} className={`det-option ${answer.options===i?"det-option-selected":""}`}><input type="radio" name={`response-${screen.id}`} checked={answer.options===i} disabled={!ready} onChange={()=>change({options:i})}/><span>{option}</span></label>)}</div>}
              {!spoken&&["dictation","summary","photo-write","writing","writing-sample"].includes(meta.task)&&<div><textarea aria-label="Your response" placeholder={ready?meta.task==="dictation"?"Type what you hear…":"Your response":"Prepare your response…"} disabled={!ready} spellCheck={false} autoComplete="off" autoCorrect="off" maxLength={20000} rows={meta.task==="dictation"?4:8} value={typeof answer.text==="string"?answer.text:""} onChange={e=>change({text:e.target.value})} className={`${control} w-full resize-y text-base leading-7 disabled:bg-[#f1f3f4]`}/><p className="mt-2 text-right text-xs text-[#7a838c]">{String(answer.text??"").trim()?String(answer.text).trim().split(/\s+/).length:0} words</p></div>}
              {spoken&&ready&&!preview&&<AudioRecorder maxSeconds={meta.seconds} prepSeconds={0} onComplete={change} attemptId={attemptId} questionId={screen.id} availableSeconds={seconds} onBusyChange={setMediaBusy} onStopAvailable={recordingControl} initialValue={answer} autoStart={meta.task!=="interview"} language="en"/>}
              {spoken&&preview&&<p className="rounded-lg border border-dashed border-[#aabac5] p-5 text-center text-sm text-[#74818c]">Microphone recording is available in an authenticated attempt.</p>}
              {meta.task==="interview"&&runtime.phase==="stimulus"&&audioPlays>0&&<button type="button" onClick={()=>void beginAnswer()} className="text-sm text-[#2784bd] underline">Audio already played? Begin your response</button>}
             </>}
          </div>}
        </fieldset>
        <div className="det-actions">
          <div className="text-xs text-[#7a838c]" role="status">{busy?"Saving…":saving?"Saving response…":runtime.phase==="prep"?"Preparation":ready?"Responses save automatically":"Listen to the question"}{preview?" · Development preview":""}</div>
          {meta.task!=="word"&&<button type="button" onClick={()=>{if(recording){submitRecordingRef.current=true;stopRecordingRef.current?.();return;}void(runtime.phase==="prep"?beginAnswer():navigate());}} disabled={busy||(mediaBusy&&!recording)||(!expired&&!runtime.finished&&runtime.phase!=="prep"&&(!ready||(!hasAnswer&&!recording)))} className="det-continue">{busy||(mediaBusy&&!recording)?"SAVING…":runtime.finished?"RETRY SUBMISSION":"CONTINUE"}</button>}
        </div>
        {error&&<p role="alert" className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{error}</p>}
      </main>
      <footer className="pb-4 text-center text-[10px] text-[#8b949c]">Independent practice by Verbo Consulting · Not affiliated with Duolingo.</footer>
    </div>
  </div>;
}

function WritingSteps({step,prompt,previous,answer,ready,onChange}:{step:number;prompt:string;previous:string;answer:Record<string,unknown>;ready:boolean;onChange:(v:Record<string,unknown>)=>void}){
  const editor=<><textarea aria-label="Your response" disabled={!ready} placeholder={ready?"Your response":"Prepare your response…"} value={typeof answer.text==="string"?answer.text:""} onChange={e=>onChange({text:e.target.value})} spellCheck={false} autoCorrect="off" autoComplete="off" maxLength={20000} rows={7} className={`${control} mt-5 w-full resize-y text-base leading-7 disabled:bg-[#f1f3f4]`}/><p className="mt-2 text-right text-xs text-[#7a838c]">{String(answer.text??"").trim()?String(answer.text).trim().split(/\s+/).length:0} words</p></>;
  return <><section className="min-w-0" data-active={step===1}><h1 className="mb-5 font-semibold"><span className="mr-3 inline-grid size-7 place-items-center rounded-full text-white">1</span>Write about the topic below for 5 minutes</h1>{step===1?<><p className="text-base leading-7">{prompt}</p>{editor}</>:<div className="det-control"><p className="mb-3 text-sm font-semibold">Your previous response</p><p className="whitespace-pre-wrap text-sm leading-7">{previous||"No response submitted."}</p></div>}</section><section className="min-w-0" data-active={step===2}><h2 className="mb-5 font-semibold"><span className="mr-3 inline-grid size-7 place-items-center rounded-full text-white">2</span>Write a follow-up response for 3 minutes</h2>{step===2?<><p className="text-base leading-7">{prompt}</p>{editor}</>:<p className="sr-only">The follow-up question appears after you submit your first response.</p>}</section></>;
}

function ReadingCloze({passage,blanks,value,onChange}:{passage:string;blanks:{options:string[]}[];value:Record<string,unknown>;onChange:(v:Record<string,unknown>)=>void}){
  return <p className="leading-[3]">{passage.split(/(___\d+___)/g).map((part,n)=>{const match=/^___(\d+)___$/.exec(part);if(!match)return <span key={n}>{part}</span>;const i=Number(match[1]);return <select key={n} aria-label={`Missing word ${i+1}`} value={(value.choices as number[]|undefined)?.[i]??""} onChange={e=>{const choices=[...((value.choices as unknown[])??[])];choices[i]=Number(e.target.value);onChange({choices});}} className={`${control} mx-1 py-1`}><option value="" disabled>select</option>{blanks[i].options.map((option,j)=><option key={j} value={j}>{option}</option>)}</select>;})}</p>;
}

function DetAudio({src,plays,limit,onStarted,onEnded,onError}:{src:string;plays:number;limit:number;onStarted:()=>Promise<void>;onEnded?:()=>Promise<void>;onError:(error:string)=>void}){
  const ref=useRef<HTMLAudioElement>(null),[playing,setPlaying]=useState(false),[starting,setStarting]=useState(false);
  async function play(){if(starting||playing||plays>=limit)return;setStarting(true);try{await onStarted();await ref.current?.play();setPlaying(true);}catch(e){onError(e instanceof Error?e.message:"Audio could not be played.");}finally{setStarting(false);}}
  return <div className="det-audio"><audio ref={ref} src={src} preload="auto" onEnded={()=>{setPlaying(false);void onEnded?.().catch(()=>onError("Could not start the response. Please retry."));}} onError={()=>{setPlaying(false);onError("No se pudo cargar el audio. Recarga antes de continuar.");}}/><button type="button" onClick={()=>void play()} disabled={playing||starting||plays>=limit} aria-label="Play question audio" className="det-audio-play">{playing?<span className="det-audio-playing" aria-hidden="true">{[0,1,2,3,4].map(i=><i key={i}/>)}</span>:<svg aria-hidden="true" width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m11 5-6 4H2v6h3l6 4V5Z"/><path d="M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/></svg>}</button><div role="status"><p className="text-base font-semibold">{starting?"Loading…":playing?"Listening…":plays>=limit?"Audio played":"Click to listen"}</p><p className="mt-1 text-sm text-[#777]">{Number.isFinite(limit)?`${Math.max(0,limit-plays)} ${limit===1?"play":"plays"} remaining`:"Replay the scenario as needed"}</p></div></div>;
}
function LetterBlanks({text,value,onChange}:{text:string;value:Record<string,unknown>;onChange:(v:Record<string,unknown>)=>void}){
  const parts=text.split(/(\[[^\]]+\])/g);let index=0;
  return <div className="text-lg leading-[2.8]">{parts.map((part,n)=>{if(!part.startsWith("["))return <span key={n}>{part}</span>;const i=index++,length=part.length-2;return <input key={n} data-letter-index={i} aria-label={`Missing letters ${i+1}`} autoComplete="off" autoCorrect="off" spellCheck={false} maxLength={length} value={(value.answers as string[]|undefined)?.[i]??""} onChange={e=>{const answers=[...((value.answers as string[])??[])];answers[i]=e.target.value.replace(/[^a-zA-Z]/g,"");onChange({answers});if(answers[i].length===length)e.currentTarget.parentElement?.querySelector<HTMLInputElement>(`[data-letter-index="${i+1}"]`)?.focus();}} onKeyDown={e=>{if(e.key==="Backspace"&&!e.currentTarget.value)e.currentTarget.parentElement?.querySelector<HTMLInputElement>(`[data-letter-index="${i-1}"]`)?.focus();}} className="det-letter" style={{width:`calc(${length}ch + ${length*.16}em + 3px)`}}/>;})}</div>;
}
function Highlight({passage,value,onChange}:{passage:string;value:Record<string,unknown>;onChange:(v:Record<string,unknown>)=>void}){
  const anchor=useRef<number|null>(null),dragging=useRef(false);
  function choose(index:number){const start=anchor.current??index;onChange({start:Math.min(start,index),end:Math.max(start,index)});}
  const selected=(i:number)=>Number.isInteger(value.start)&&Number(value.start)<=i&&Number(value.end)>=i;
  return <p className="det-highlight select-none leading-8" onPointerDown={e=>{const word=(e.target as HTMLElement).closest<HTMLElement>("[data-word-index]");if(!word)return;e.preventDefault();anchor.current=Number(word.dataset.wordIndex);dragging.current=true;e.currentTarget.setPointerCapture(e.pointerId);choose(anchor.current);}} onPointerMove={e=>{if(!dragging.current)return;const word=document.elementFromPoint(e.clientX,e.clientY)?.closest<HTMLElement>("[data-word-index]");if(word&&e.currentTarget.contains(word))choose(Number(word.dataset.wordIndex));}} onPointerUp={()=>{dragging.current=false;}} onPointerCancel={()=>{dragging.current=false;}}>{passage.split(/\s+/).map((word,i)=><span key={i}><button type="button" data-word-index={i} aria-label={`Word ${i+1}: ${word}`} aria-pressed={selected(i)} onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();if(!e.shiftKey)anchor.current=i;choose(i);}}}>{word}</button>{" "}</span>)}</p>;
}
