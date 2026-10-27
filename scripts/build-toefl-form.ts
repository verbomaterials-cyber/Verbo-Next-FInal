import { writeFile, mkdir } from "node:fs/promises";
import { toeflForms } from "../content/toefl-2026/forms";
async function main() {
await mkdir(".local/toefl", { recursive: true });
for (const form of toeflForms) {
  await writeFile(`.local/toefl/form-${form.number}.json`, JSON.stringify(form.data, null, 2));
  await writeFile(`.local/toefl/form-${form.number}-audio.json`, JSON.stringify(form.audioScripts, null, 2));
  console.log(`${form.label}: ${form.data.questions.length} registros y ${form.audioScripts.length} guiones de audio.`);
}
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
