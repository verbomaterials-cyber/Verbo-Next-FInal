"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { startAttempt } from "@/lib/student/actions";
import { TOEFL_FORMAT } from "@/lib/toefl-format";

export function EquipmentCheck({ versionId, label, examName, questionCount, det=false }: {
  versionId: string; label: string; examName: string; questionCount: number; det?: boolean;
}) {
  const router = useRouter();
  const [soundReady, setSoundReady] = useState(false);
  const [mic, setMic] = useState<"idle" | "requesting" | "testing" | "ready" | "error">("idle");
  const [level, setLevel] = useState(0);
  const [accepted, setAccepted] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const peakRef = useRef(0);

  function releaseMicrophone() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    void contextRef.current?.close();
    contextRef.current = null;
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; releaseMicrophone(); };
  }, []);

  async function testMicrophone() {
    setMic("requesting");
    setError(null);
    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
        throw new Error("Este navegador no permite grabar audio. Abre la plataforma en una versión reciente de Chrome o Edge.");
      }
      releaseMicrophone();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!mountedRef.current) { stream.getTracks().forEach((track) => track.stop()); return; }
      streamRef.current = stream;
      const context = new AudioContext();
      contextRef.current = context;
      await context.resume();
      const analyser = context.createAnalyser();
      analyser.fftSize = 256;
      context.createMediaStreamSource(stream).connect(analyser);
      const samples = new Uint8Array(analyser.fftSize);
      peakRef.current = 0;
      setMic("testing");
      intervalRef.current = setInterval(() => {
        analyser.getByteTimeDomainData(samples);
        const amplitude = Math.max(...samples.map((value) => Math.abs(value - 128)));
        peakRef.current = Math.max(peakRef.current, amplitude);
        setLevel(Math.min(100, amplitude * 4));
      }, 100);
      timeoutRef.current = setTimeout(() => {
        releaseMicrophone();
        if (peakRef.current < 2) {
          setMic("error");
          setError("No detectamos sonido. Comprueba que el micrófono seleccionado no esté silenciado y vuelve a hablar durante la prueba.");
        } else setMic("ready");
      }, 5000);
    } catch (e) {
      releaseMicrophone();
      if (!mountedRef.current) return;
      setMic("error");
      setError(e instanceof Error && e.name !== "NotAllowedError" ? e.message : "Permite el uso del micrófono en el navegador y vuelve a probar.");
    }
  }

  async function begin() {
    if (!soundReady || mic !== "ready" || !accepted || starting) return;
    setStarting(true);
    setError(null);
    try {
      const result = await startAttempt({ examVersionId: versionId });
      if (!result.ok || !result.data) { setError(result.ok ? "No se pudo iniciar el examen." : result.error); return; }
      router.push(`/alumno/intento/${result.data.attemptId}`);
    } catch { setError("No se pudo conectar con el servidor. Reintenta antes de comenzar."); }
    finally { setStarting(false); }
  }

  return <div className="mx-auto max-w-3xl">
    <Link href="/alumno" className="text-sm text-ink-muted hover:text-brand">← Mis exámenes</Link>
    <div className="mt-7 mb-8"><p className="mb-2 text-xs font-semibold tracking-[0.15em] text-brand">ANTES DE COMENZAR</p>
      <h1 className="text-3xl font-semibold tracking-tight">Prepara tu espacio</h1>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-muted">{examName} · {label} · {questionCount} tareas. Comprueba el sonido y el micrófono antes de que empiece a correr el tiempo.</p>
    </div>
    <div className="grid gap-4 sm:grid-cols-2">
      <section className="rounded-2xl border border-line bg-surface p-6">
        <p className="mb-4 text-xs font-semibold text-brand">01 · SONIDO</p><h2 className="text-lg font-semibold">{det?"Comprueba tus bocinas":"Usa audífonos"}</h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-muted">Reproduce el ejemplo y comprueba que escuchas la voz con claridad.</p>
        <audio controls preload="none" className="mt-5 w-full" aria-label="Prueba de sonido"
          src={det?"/audio/det-2026/dictation-1-0.wav":"/audio/toefl-2026/choose-response.wav"} onEnded={() => setSoundReady(true)}
          onError={() => { setSoundReady(false); setError("No se pudo cargar el ejemplo de sonido. Revisa la conexión local."); }} />
        <p className="mt-4 text-xs font-medium" role="status">{soundReady ? "✓ Prueba de sonido completada" : "Reproduce el audio completo para continuar"}</p>
      </section>
      <section className="rounded-2xl border border-line bg-surface p-6">
        <p className="mb-4 text-xs font-semibold text-brand">02 · MICRÓFONO</p><h2 className="text-lg font-semibold">Comprueba tu voz</h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-muted">Permite el micrófono y habla durante cinco segundos. Esta prueba no se guarda ni se envía.</p>
        <div className="mt-5 h-2 overflow-hidden rounded-full bg-background" role="meter" aria-label="Nivel del micrófono" aria-valuenow={Math.round(level)} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full rounded-full bg-brand transition-[width]" style={{ width: `${level}%` }} />
        </div>
        <button type="button" onClick={() => void testMicrophone()} disabled={mic === "requesting" || mic === "testing"}
          className="mt-4 rounded-full border border-line-strong px-4 py-2 text-sm font-medium disabled:opacity-50">
          {mic === "testing" ? "Habla ahora…" : mic === "requesting" ? "Esperando permiso…" : mic === "ready" ? "Volver a probar" : "Probar micrófono"}
        </button>
        <p className="mt-3 text-xs font-medium" role="status">{mic === "ready" ? "✓ Micrófono detectado y permiso concedido" : ""}</p>
      </section>
    </div>
    <section className="mt-6 rounded-2xl border border-line bg-surface p-6">
      <h2 className="text-lg font-semibold">Durante el intento</h2>
      <p className="mt-3 text-sm leading-relaxed text-ink-muted">Busca un lugar tranquilo, conecta tu equipo a la corriente y cierra las aplicaciones que puedan interrumpirte. El reloj continúa aunque recargues o cierres la página.</p>
      {det?<div className="mt-5 space-y-3 text-sm leading-relaxed text-ink-muted"><p>Reserva una hora. Las tareas se mezclan, no puedes volver atrás y las conversaciones y lecturas interactivas comparten su reloj. Writing y Speaking Sample aparecen al final.</p><p>En el DET oficial se usan bocinas, no audífonos. Esta práctica guarda audio para revisión del profesor; no realiza verificación de identidad ni supervisión por cámara. Speaking Sample se conserva aquí como audio, mientras el oficial utiliza video.</p><p>La selección de dificultad usa una regla editorial sobre tareas cortas. Los seguimientos de escritura y speaking son guiones de práctica; no interpretan automáticamente tu voz. El índice de práctica no predice el puntaje oficial.</p></div>:<div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">{TOEFL_FORMAT.sections.map((section) => <div key={section.name} className="rounded-lg bg-background p-3 text-sm"><p className="font-medium">{section.name}</p><p className="mt-1 text-xs text-ink-muted">Base: {section.minutes} min</p></div>)}</div>}
      {!det&&questionCount < 100 && <p className="mt-4 text-xs leading-relaxed text-ink-muted">Esta versión es un recorrido corto de práctica. Los tiempos de referencia pertenecen al formato completo; esta versión contiene {questionCount} tareas.</p>}
      <label className="mt-6 flex items-start gap-3 text-sm leading-relaxed"><input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} className="mt-1 size-4 accent-(--brand)" />Estoy listo para comenzar y tengo tiempo para realizar el intento sin interrupciones.</label>
    </section>
    {error && <p role="alert" className="mt-4 rounded-lg bg-danger-soft p-4 text-sm text-danger">{error}</p>}
    <button type="button" onClick={() => void begin()} disabled={!soundReady || mic !== "ready" || !accepted || starting}
      className="mt-6 w-full rounded-full bg-brand px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-strong disabled:cursor-not-allowed disabled:opacity-40">
      {starting ? "Preparando el intento…" : "Comenzar examen →"}
    </button>
  </div>;
}
