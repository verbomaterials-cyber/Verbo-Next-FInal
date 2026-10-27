import { readFile, writeFile, mkdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import path from "node:path";
const engine = path.resolve(".local/voice-tools/piper/piper/piper.exe");
const partsRoot = path.resolve(".local/toefl/neural-parts");
await mkdir(partsRoot, { recursive: true });
const selected = process.argv.filter((arg) => /^[23]$/.test(arg)).map(Number);
const forms = selected.length ? selected : [2, 3];
const models = ["en_US-libritts_r-medium.onnx", "en_GB-vctk-medium.onnx"];
const profiles = [
  { model: 0, speaker: 0, locale: "en-US", label: "US A" },
  { model: 0, speaker: 1, locale: "en-US", label: "US B" },
  { model: 1, speaker: 0, locale: "en-GB", label: "GB A" },
  { model: 1, speaker: 1, locale: "en-GB", label: "GB B" },
];
const jobs = [], clips = [];
for (const number of forms) {
  const scripts = JSON.parse(await readFile(`.local/toefl/form-${number}-audio.json`, "utf8"));
  await mkdir(`public/audio/toefl-2026/form-${number}`, { recursive: true });
  for (const script of scripts) {
    if (!/^[a-z0-9-]+$/.test(script.id)) throw new Error("Identificador de audio inválido.");
    const base = script.id.includes("s-repeat") ? (number === 2 ? 0 : 2) : script.id.includes("s-interview") ? (number === 2 ? 2 : 0) : [...script.id].reduce((n, ch) => n + ch.charCodeAt(0), 0) % 4;
    const parts = script.turns.map((turn, index) => {
      const profile = profiles[(base + turn.voice) % profiles.length];
      const textHash = createHash("sha256").update(`${profile.label}:1.35:${turn.text}`).digest("hex").slice(0, 14);
      const output = path.join(partsRoot, `${script.id}-${index}-${textHash}.wav`);
      jobs.push({ text: turn.text, speaker_id: profile.speaker, output_file: output, model: profile.model });
      return { file: output, profile };
    });
    clips.push({ number, id: script.id, parts });
  }
}
for (const modelIndex of [0, 1]) {
  const missing = [];
  for (const job of jobs.filter((job) => job.model === modelIndex)) {
    try { if ((await readFile(job.output_file)).length > 1000) continue; } catch { /* Missing cached part. */ }
    missing.push(job);
  }
  if (!missing.length) continue;
  await new Promise((resolve, reject) => {
    const child = spawn(engine, ["--model", path.resolve(`.local/voices/${models[modelIndex]}`), "--json-input", "--length_scale", "1.35", "--sentence_silence", "0.12", "--quiet"], { cwd: path.dirname(engine), windowsHide: true, stdio: ["pipe", "ignore", "pipe"] });
    let errors = "";
    child.stderr.on("data", (bytes) => { errors = (errors + bytes.toString()).slice(-3000); });
    child.on("error", reject);
    child.on("exit", (code) => code === 0 ? resolve() : reject(new Error(`Piper: ${code}: ${errors}`)));
    child.stdin.on("error", reject);
    child.stdin.end(missing.map(({ text, speaker_id, output_file }) => JSON.stringify({ text, speaker_id, output_file })).join("\n") + "\n");
  });
  console.log(`Síntesis local ${models[modelIndex]}: ${missing.length} intervenciones.`);
}
function wavData(bytes) {
  if (bytes.toString("ascii", 0, 4) !== "RIFF") throw new Error("Audio de síntesis inválido.");
  let format, data;
  for (let offset = 12; offset + 8 <= bytes.length;) {
    const name = bytes.toString("ascii", offset, offset + 4), size = bytes.readUInt32LE(offset + 4);
    if (name === "fmt ") format = bytes.subarray(offset + 8, offset + 8 + size);
    if (name === "data") data = bytes.subarray(offset + 8, offset + 8 + size);
    offset += 8 + size + (size % 2);
  }
  if (!format || !data || format.readUInt16LE(0) !== 1 || format.readUInt16LE(2) !== 1 || format.readUInt16LE(14) !== 16) throw new Error("Se esperaba PCM mono de 16 bits.");
  return { format, data };
}
const manifest = [];
for (const clip of clips) {
  const buffers = await Promise.all(clip.parts.map(async (part) => wavData(await readFile(part.file))));
  const format = buffers[0].format;
  if (buffers.some((part) => !part.format.equals(format))) throw new Error("Los formatos de voz no coinciden.");
  const byteRate = format.readUInt32LE(8);
  const silence = Buffer.alloc(Math.round(byteRate * .16 / 2) * 2);
  const pcm = Buffer.concat(buffers.flatMap((part, i) => i === buffers.length - 1 ? [part.data] : [part.data, silence]));
  const header = Buffer.alloc(44);
  header.write("RIFF", 0); header.writeUInt32LE(36 + pcm.length, 4); header.write("WAVEfmt ", 8); header.writeUInt32LE(16, 16);
  format.copy(header, 20, 0, 16); header.write("data", 36); header.writeUInt32LE(pcm.length, 40);
  const bytes = Buffer.concat([header, pcm]);
  const target = `public/audio/toefl-2026/form-${clip.number}/${clip.id}.wav`;
  await writeFile(target, bytes);
  manifest.push({ path: target.replace("public", ""), seconds: Number((pcm.length / byteRate).toFixed(2)), voices: [...new Set(clip.parts.map((part) => part.profile.label))], locales: [...new Set(clip.parts.map((part) => part.profile.locale))], sha256: createHash("sha256").update(bytes).digest("hex") });
}
await writeFile(`public/audio/toefl-2026/voices-forms-${forms.join("-")}.json`, JSON.stringify({ engine: "Piper 2023.11.14-2", synthesis: "offline", lengthScale: 1.35, attribution: "/audio/toefl-2026/VOICE-CREDITS.md", clips: manifest }, null, 2));
console.log(`${clips.length} audios listos; cuatro voces y dos variedades de inglés. No se modificó el audio de los intentos anteriores.`);
