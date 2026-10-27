"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { startAttempt } from "@/lib/student/actions";
import { Icon } from "@/components/icons";
export function VersionCard({ versionId, label, hasFeedback, questionCount, unlocked, resumable, attemptsLeft, requiresSetup = false, fullLength = false, detFull = false }: {
  versionId: string; label: string; hasFeedback: boolean; questionCount: number; unlocked: boolean; resumable: boolean;
  attemptsLeft: number; requiresSetup?: boolean; fullLength?: boolean; detFull?: boolean;
}) {
  const router = useRouter(), [starting, setStarting] = useState(false), [error, setError] = useState<string | null>(null);
  const startable = unlocked && questionCount > 0 && (attemptsLeft > 0 || resumable);
  async function start() {
    if (!startable || starting) return;
    if (requiresSetup && !resumable) { router.push(`/alumno/preparacion/${versionId}`); return; }
    setStarting(true); setError(null);
    try {
      const result = await startAttempt({ examVersionId: versionId });
      if (!result.ok || !result.data) { setError(result.ok ? "No se pudo abrir el intento. Vuelve a intentarlo." : result.error); setStarting(false); return; }
      router.push(`/alumno/intento/${result.data.attemptId}`);
    } catch { setError("No pudimos conectar. Revisa tu conexión y vuelve a intentarlo."); setStarting(false); }
  }
  return <div className={`version-card ${unlocked ? "" : "version-card-locked"}`}>
    <div className="flex items-center justify-between gap-3"><span className={`status-pill ${resumable ? "status-pill-progress" : !unlocked ? "status-pill-blocked" : ""}`}>{resumable ? "En curso" : unlocked ? "Disponible" : "Bloqueado"}</span><Icon name={resumable ? "play" : hasFeedback ? "book" : "target"} size={20} className="text-ink-muted" /></div>
    <h2>{label}</h2><p>{hasFeedback ? "Práctica con revisión y feedback por pregunta." : "Tu punto de partida, sin feedback por pregunta."}</p>
    <div className="version-card-details"><p>{questionCount} {detFull ? "pantallas" : "preguntas"}{resumable ? " · Reloj persistente" : requiresSetup ? " · Revisión de equipo antes de iniciar" : ""}</p>{fullLength && <p className="mt-2">Reading y Listening por módulos. Writing y Speaking con rúbricas.</p>}{detFull && <p className="mt-2">Lecturas, conversaciones, escritura en dos etapas y respuestas orales.</p>}</div>
    {error && <p role="alert" className="mb-4 rounded-lg bg-danger-soft p-3 text-sm text-danger">{error}</p>}
    {unlocked ? <button type="button" onClick={start} disabled={!startable || starting} className="next-button" aria-busy={starting}>{starting ? "Abriendo tu práctica…" : resumable ? "Retomar intento" : !questionCount ? "Contenido en preparación" : attemptsLeft <= 0 ? "Sin intentos disponibles" : "Preparar mi intento"}<Icon name={resumable ? "play" : "arrow"} size={17} /></button> : <p className="version-locked"><Icon name="lock" size={16} />Tu asesor puede habilitar esta versión.</p>}
  </div>;
}
