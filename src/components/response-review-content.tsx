import Image from "next/image";

export function answerSummary(
  answer: Record<string, unknown>,
  prompt: Record<string, unknown>,
): string {
  if(typeof answer.options==="number" && prompt.options && typeof prompt.options==="object" && Array.isArray((prompt.options as {options?:unknown}).options))return String((prompt.options as {options:string[]}).options[answer.options]??"—");
  if(typeof answer.start==="number"&&typeof answer.end==="number"&&typeof prompt.passage==="string")return prompt.passage.split(/\s+/).slice(answer.start,answer.end+1).join(" ");
  if(Array.isArray(answer.choices)&&Array.isArray(prompt.blanks))return answer.choices.map((v,i)=>(prompt.blanks as {options:string[]}[])[i]?.options[Number(v)]??"—").join(" · ");
  if(Array.isArray(answer.accepted))return answer.accepted.map(v=>Array.isArray(v)?v.join(" / "):String(v)).join(" · ");
  if(typeof answer.transcript==="string")return answer.transcript;
  if (Array.isArray(answer.order) && Array.isArray(prompt.wordBank)) return answer.order.map((index) => (prompt.wordBank as string[])[Number(index)] ?? "?").join(" ");
  if (typeof answer.text === "string") return `“${truncate(answer.text, 160)}”`;
  if (answer.recorded === true) return `grabación de audio (${answer.durationSeconds}s)`;
  if (answer.recorded === false) return "sin audio (micrófono no disponible)";
  if (Array.isArray(answer.answers)) return (answer.answers as string[]).join(" · ");

  // índices elegidos → texto de las opciones si existe en el prompt
  for (const [key, value] of Object.entries(answer)) {
    const options = prompt[key];
    if (Array.isArray(options) && options.every((o) => typeof o === "string")) {
      const opts = options as string[];
      if (typeof value === "number") return `“${opts[value] ?? value}”`;
      if (Array.isArray(value))
        return (value as number[]).map((i) => `“${opts[i] ?? i}”`).join(", ");
    }
  }
  return truncate(JSON.stringify(answer), 120);
}

export function ReviewPrompt({ prompt, correct }: { prompt: Record<string, unknown>; correct: Record<string, unknown> | null }) {
  return <div className="mt-3 space-y-3 rounded-lg bg-background p-4 text-sm leading-relaxed">
    {["instruction", "title", "passage", "text", "question", "scenario", "professorPost"].map((key) => typeof prompt[key] === "string" && <p key={key} className="whitespace-pre-wrap">{String(prompt[key])}</p>)}
    {typeof prompt.imageUrl==="string"&&<Image unoptimized src={prompt.imageUrl} alt="Foto del ejercicio" width={600} height={450} className="h-auto max-h-72 w-auto object-contain"/>}
    {typeof prompt._transcript==="string"&&<p><b>Transcripción: </b>{prompt._transcript}</p>}
    {Array.isArray(prompt.requiredPoints) && <ul className="list-disc pl-5">{prompt.requiredPoints.map((point, index) => <li key={index}>{String(point)}</li>)}</ul>}
    {Array.isArray(prompt.studentReplies) && prompt.studentReplies.map((reply, index) => { const entry = reply as { author: string; text: string }; return <p key={index}><b>{entry.author}: </b>{entry.text}</p>; })}
    {typeof prompt.audioUrl === "string" && <audio preload="none" controls className="w-full" src={prompt.audioUrl} aria-label="Audio de la consigna" />}
    {typeof prompt.transcript === "string" && <p className="whitespace-pre-wrap"><b>Transcripción: </b>{prompt.transcript}</p>}
    {correct && <p><b>Solución: </b>{answerSummary(correct, prompt)}</p>}
  </div>;
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n)}…` : s;
}
