import { spawn, spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
function openBrowser() {
  if (process.platform === "win32") spawn("cmd.exe", ["/c", "start", "", "http://localhost:3000"], {
    windowsHide: true, stdio: "ignore",
  }).unref();
}
try {
  const response = await fetch("http://127.0.0.1:3000/api/local-health", { signal: AbortSignal.timeout(1500) });
  if (response.ok && (await response.json()).application === "verbo-next-local") {
    console.log("Verbo NEXT ya está funcionando en http://localhost:3000.");
    if (process.argv.includes("--open")) openBrowser();
    process.exit(0);
  }
} catch { /* No existing Verbo server on the expected port. */ }
const started = spawnSync(process.execPath, ["scripts/local-db.mjs", "start"], {
  cwd: root, stdio: "inherit", windowsHide: true,
});
if (started.status !== 0) process.exit(started.status ?? 1);
const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "--webpack", "--hostname", "127.0.0.1", "--port", "3000"], {
  cwd: root, stdio: "inherit", windowsHide: true,
});
server.on("error", (error) => { console.error(error.message); process.exitCode = 1; });
server.on("exit", (code) => { process.exitCode = code ?? 0; });
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => server.kill());
if (process.argv.includes("--open") && process.platform === "win32") {
  for (let tries = 0; tries < 40 && server.exitCode === null; tries++) {
    try {
      const response = await fetch("http://127.0.0.1:3000/login");
      if (response.ok) {
        openBrowser();
        break;
      }
    } catch { /* Wait until Next is listening. */ }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
}
