import { mkdir, readFile, writeFile, rename, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
const root = path.resolve(".local");
const voicesDir = path.join(root, "voices");
const toolsDir = path.join(root, "voice-tools");
await mkdir(voicesDir, { recursive: true }); await mkdir(toolsDir, { recursive: true });
async function json(url) { const r = await fetch(url, { headers: { "User-Agent": "Verbo-NEXT-local-voice-setup" } }); if (!r.ok) throw new Error(`${r.status}: ${url}`); return r.json(); }
async function download(url, target, expected) {
  if (!path.resolve(target).startsWith(root + path.sep)) throw new Error("Destino fuera de .local.");
  try { const old = await readFile(target); if (old.length > 0 && (!expected || createHash("sha256").update(old).digest("hex") === expected)) return; } catch { /* Download missing files. */ }
  const response = await fetch(url, { signal: AbortSignal.timeout(180000) });
  if (!response.ok) throw new Error(`${response.status}: ${url}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  const hash = createHash("sha256").update(bytes).digest("hex");
  if (expected && hash !== expected) throw new Error("La suma de verificación de la voz no coincide.");
  await writeFile(`${target}.partial`, bytes); await rename(`${target}.partial`, target);
  console.log(`Descargado ${path.basename(target)} (${Math.round(bytes.length / 1048576)} MB)`);
}
const release = await json("https://api.github.com/repos/rhasspy/piper/releases/tags/2023.11.14-2");
const asset = release.assets.find((item) => item.name === "piper_windows_amd64.zip");
if (!asset) throw new Error("No se encontró el binario oficial de Windows.");
await download(asset.browser_download_url, path.join(toolsDir, asset.name), asset.digest?.replace("sha256:", ""));
const repo = await json("https://huggingface.co/api/models/rhasspy/piper-voices/revision/main");
const revision = repo.sha;
const manifest = { engine: { version: release.tag_name, source: release.html_url }, revision, voices: [] };
for (const [locale, name] of [["en_US", "libritts_r"], ["en_GB", "vctk"]]) {
  const folder = `en/${locale}/${name}/medium`;
  const listing = await json(`https://huggingface.co/api/models/rhasspy/piper-voices/tree/${revision}/${folder}`);
  const modelName = `${locale}-${name}-medium.onnx`;
  for (const filename of [modelName, `${modelName}.json`, "MODEL_CARD"]) {
    const item = listing.find((entry) => entry.path === `${folder}/${filename}`);
    if (!item) throw new Error(`Falta el archivo de voz ${filename}`);
    const target = path.join(voicesDir, filename === "MODEL_CARD" ? `${locale}-${name}-MODEL_CARD.md` : filename);
    await download(`https://huggingface.co/rhasspy/piper-voices/resolve/${revision}/${folder}/${filename}`, target, item.lfs?.oid);
  }
  manifest.voices.push({ locale, name, model: modelName, license: "CC BY 4.0 (dataset attribution in MODEL_CARD)", source: `https://huggingface.co/rhasspy/piper-voices/tree/${revision}/${folder}`, bytes: (await stat(path.join(voicesDir, modelName))).size });
}
await writeFile(path.join(voicesDir, "manifest.json"), JSON.stringify(manifest, null, 2));
console.log("Voces listas para síntesis sin conexión.");
