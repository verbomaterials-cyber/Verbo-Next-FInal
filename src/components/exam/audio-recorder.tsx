"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { formatTime } from "./exam-timer";

export type RecordingResult = {
  recorded: boolean;
  durationSeconds: number;
  /** presente si el micrófono falló y el alumno continuó sin audio */
  error?: string;
  recordingId?: string;
  audioUrl?: string;
};

/*
 * <AudioRecorder maxSeconds prepSeconds> — MediaRecorder nativo.
 * Flujo: conteo de preparación (si aplica) → grabación con anillo animado
 * y countdown → fin (manual o por tiempo).
 * Reports success only after the server has persisted the actual audio.
 */
export function AudioRecorder({
  maxSeconds,
  prepSeconds,
  onComplete,
  attemptId,
  questionId,
  availableSeconds,
  onBusyChange,
  initialValue,
  autoStart = false,
  language = "es",
  onStopAvailable,
}: {
  maxSeconds: number;
  prepSeconds: number | null;
  onComplete: (result: RecordingResult) => void;
  attemptId: string;
  questionId: string;
  availableSeconds: number;
  onBusyChange: (busy: boolean) => void;
  initialValue?: Partial<RecordingResult>;
  autoStart?: boolean;
  language?: "en" | "es";
  /** Lets an exam's Continue button stop and persist the active recording. */
  onStopAvailable?: (stop: (() => void) | null) => void;
}) {
  const [phase, setPhase] = useState<"idle" | "prep" | "recording" | "saving" | "done" | "error">(
    initialValue?.recordingId ? "done" : "idle",
  );
  const [countdown, setCountdown] = useState(prepSeconds ?? 0);
  const [elapsed, setElapsed] = useState(initialValue?.durationSeconds ?? 0);
  const [error, setError] = useState<string | null>(null);
  const [savedUrl, setSavedUrl] = useState(initialValue?.audioUrl);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const elapsedRef = useRef(0);
  const startedRef = useRef(0);
  const chunksRef = useRef<BlobPart[]>([]);
  const blobRef = useRef<Blob | null>(null);
  const mountedRef = useRef(true);
  const autoStartedRef = useRef(false);

  const upload = useCallback(async () => {
    const blob = blobRef.current;
    if (!blob) return;
    setPhase("saving");
    setError(null);
    onBusyChange(true);
    try {
      if (blob.size > 4 * 1024 * 1024) throw new Error("La grabación supera 4 MB. Contacta a tu asesor para conservar tu respuesta.");
      const response = await fetch(`/api/intentos/${attemptId}/grabacion/${questionId}`, {
        method: "POST", body: blob,
        headers: { "Content-Type": blob.type, "x-duration-seconds": String(elapsedRef.current) },
      });
      if (response.status === 413) throw new Error("La grabación supera el tamaño permitido. Contacta a tu asesor para conservar tu respuesta.");
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "No se pudo guardar el audio.");
      if (!mountedRef.current) return;
      setSavedUrl(result.audioUrl);
      onComplete(result as RecordingResult);
      setPhase("done");
      onBusyChange(false);
      blobRef.current = null;
    } catch (e) {
      if (!mountedRef.current) return;
      setError(e instanceof Error ? e.message : "No se pudo guardar el audio.");
      setPhase("error");
      // Retain the blob and keep navigation blocked until retry or explicit skip.
    }
  }, [attemptId, questionId, onComplete, onBusyChange]);

  const uploadRef = useRef(upload);
  useEffect(() => { uploadRef.current = upload; }, [upload]);

  const beginRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!mountedRef.current) { stream.getTracks().forEach((track) => track.stop()); return; }
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream, { audioBitsPerSecond: 64_000 });
      recorderRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = (event) => { if (event.data.size) chunksRef.current.push(event.data); };
      recorder.onstop = () => {
        blobRef.current = new Blob(chunksRef.current, { type: recorder.mimeType });
        stream.getTracks().forEach((track) => track.stop());
        void uploadRef.current();
      };
      recorder.start(250);
      startedRef.current = Date.now();
      elapsedRef.current = 0;
      setElapsed(0);
      setPhase("recording");
    } catch {
      setError("No pudimos acceder a tu micrófono. Revisa los permisos del navegador.");
      setPhase("error");
      onBusyChange(false);
    }
  }, [onBusyChange]);

  const stopRecording = useCallback(() => {
    if (recorderRef.current?.state !== "recording") return;
    elapsedRef.current = Math.min(maxSeconds, Math.ceil((Date.now() - startedRef.current) / 1000));
    setElapsed(elapsedRef.current);
    setPhase("saving");
    recorderRef.current.stop();
  }, [maxSeconds]);

  useEffect(() => {
    onStopAvailable?.(phase === "recording" ? stopRecording : null);
    return () => onStopAvailable?.(null);
  }, [phase, stopRecording, onStopAvailable]);

  const start = useCallback(() => {
    onBusyChange(true);
    setError(null);
    if (prepSeconds && prepSeconds > 0) {
      setCountdown(Math.min(prepSeconds, availableSeconds));
      setPhase("prep");
    } else {
      void beginRecording();
    }
  }, [onBusyChange, prepSeconds, availableSeconds, beginRecording]);

  useEffect(() => {
    if (!autoStart || phase !== "idle" || autoStartedRef.current) return;
    const timer = setTimeout(() => { autoStartedRef.current = true; start(); }, 0);
    return () => clearTimeout(timer);
  }, [autoStart, phase, start]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (recorderRef.current) {
        recorderRef.current.onstop = null;
        if (recorderRef.current.state === "recording") recorderRef.current.stop();
      }
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  /* preparación */
  useEffect(() => {
    if (phase !== "prep") return;
    if (countdown <= 0) {
      const timer = setTimeout(() => void beginRecording(), 0);
      return () => clearTimeout(timer);
    }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, countdown, beginRecording]);

  /* grabación */
  useEffect(() => {
    if (phase !== "recording") return;
    const t = setInterval(() => {
      elapsedRef.current = Math.min(maxSeconds, Math.ceil((Date.now() - startedRef.current) / 1000));
      setElapsed(elapsedRef.current);
      if (elapsedRef.current >= maxSeconds) stopRecording();
    }, 1000);
    return () => clearInterval(t);
  }, [phase, maxSeconds, stopRecording]);

  useEffect(() => {
    if (availableSeconds > 0 || phase !== "recording") return;
    const timeout = setTimeout(stopRecording, 0);
    return () => clearTimeout(timeout);
  }, [availableSeconds, phase, stopRecording]);

  function continueWithoutAudio() {
    blobRef.current = null;
    setPhase("done");
    onComplete({ recorded: false, durationSeconds: 0, error: "mic-unavailable" });
    onBusyChange(false);
  }

  const accentSoft = "color-mix(in oklab, var(--xaccent) 14%, transparent)";

  return (
    <div className="flex flex-col items-center gap-4 py-4">
      {phase === "idle" && (
        <>
          <MicButton onClick={start} label={language === "en" ? "Start recording" : "Comenzar"} />
          <p className="text-sm" style={{ color: "var(--xmuted)" }}>
            {language === "en" ? `You have up to ${formatTime(maxSeconds)} to respond.` : prepSeconds
              ? `Tendrás ${prepSeconds} s para prepararte y hasta ${formatTime(maxSeconds)} para responder.`
              : `Grabación directa: hasta ${formatTime(maxSeconds)} para responder.`}
          </p>
        </>
      )}

      {phase === "prep" && (
        <>
          <div
            className="flex size-24 items-center justify-center rounded-full text-4xl font-semibold tabular-nums"
            style={{
              backgroundColor: accentSoft,
              color: "var(--xaccent2)",
              fontFamily: "var(--xfont-display)",
            }}
            role="timer"
            aria-label={`Preparación: ${countdown} segundos`}
          >
            {countdown}
          </div>
          <p className="text-sm" style={{ color: "var(--xmuted)" }}>
            {language === "en" ? "Prepare your response…" : "Prepara tu respuesta…"}
          </p>
        </>
      )}

      {phase === "recording" && (
        <>
          <div className="relative">
            <span
              aria-hidden
              className="rec-ring absolute inset-0 rounded-full"
              style={{ backgroundColor: "var(--xaccent)" }}
            />
            <MicButton onClick={stopRecording} label={language === "en" ? "Stop recording" : "Detener grabación"} active />
          </div>
          <p
            className="text-xl font-semibold tabular-nums"
            role="timer"
            aria-live="polite"
            style={{ color: "var(--xink)", fontFamily: "var(--xfont-display)" }}
          >
            {formatTime(Math.max(0, Math.min(maxSeconds - elapsed, availableSeconds)))}
          </p>
          <p className="text-sm" style={{ color: "var(--xmuted)" }}>
            {language === "en" ? "Recording… select the microphone to finish." : "Grabando… toca el micrófono para terminar."}
          </p>
        </>
      )}

      {phase === "saving" && <p role="status">{language === "en" ? "Saving your recording…" : "Guardando audio…"}</p>}
      {phase === "done" && (
        <>
        <p
          className="rounded-lg px-4 py-2.5 text-sm font-medium"
          style={{ backgroundColor: accentSoft, color: "var(--xaccent2)" }}
        >
          {savedUrl ? `✓ ${language === "en" ? "Recording saved" : "Audio guardado"} (${formatTime(elapsed)})` : language === "en" ? "Response submitted without audio" : "Respuesta enviada sin audio"}
        </p>
        {savedUrl && <audio controls src={savedUrl} aria-label="Escuchar tu respuesta" />}
        </>
      )}

      {phase === "error" && (
        <div className="flex flex-col items-center gap-3">
          <p className="text-sm" style={{ color: "var(--xwarn)" }}>
            {error}
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => blobRef.current ? void upload() : start()}
              className="rounded-lg px-4 py-2 text-sm font-medium text-white"
              style={{ backgroundColor: "var(--xaccent)" }}
            >
              {language === "en" ? "Try again" : "Reintentar"}
            </button>
            <button
              type="button"
              onClick={continueWithoutAudio}
              className="rounded-lg px-4 py-2 text-sm"
              style={{ color: "var(--xmuted)" }}
            >
              {language === "en" ? "Continue without audio" : "Continuar sin audio"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function MicButton({
  onClick,
  label,
  active,
}: {
  onClick: () => void;
  label: string;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="relative flex size-24 items-center justify-center rounded-full transition-transform duration-200 hover:scale-105"
      style={{
        backgroundColor: active
          ? "var(--xaccent)"
          : "color-mix(in oklab, var(--xaccent) 16%, var(--xsurface))",
        color: active ? "var(--xon-accent)" : "var(--xaccent2)",
      }}
    >
      <svg
        width="34"
        height="34"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
        <line x1="12" y1="19" x2="12" y2="23" />
        <line x1="8" y1="23" x2="16" y2="23" />
      </svg>
    </button>
  );
}
