"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/*
 * <AudioPlayer maxReplays> — altavoz grande centrado con contador de
 * reproducciones restantes (patrón Listen and Type del DET / audio único TOEFL).
 * maxReplays null = ilimitado.
 */
export function AudioPlayer({
  src,
  maxReplays,
  onComplete,
  language = "es",
  consumed = false,
  autoPlay = false,
  onStarted,
  onBusyChange,
}: {
  src: string;
  maxReplays: number | null;
  onComplete?: () => void;
  language?: "en" | "es";
  consumed?: boolean;
  autoPlay?: boolean;
  onStarted?: () => Promise<void>;
  onBusyChange?: (busy: boolean) => void;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [playsUsed, setPlaysUsed] = useState(0);
  const [playError, setPlayError] = useState<string | null>(null);
  const startedRef = useRef(false);
  const attemptedAutoRef = useRef(false);
  const onBusyRef = useRef(onBusyChange);
  useEffect(() => { onBusyRef.current = onBusyChange; }, [onBusyChange]);

  const remaining = maxReplays === null ? null : Math.max(0, maxReplays - Math.max(playsUsed, consumed ? 1 : 0));
  const exhausted = remaining !== null && remaining <= 0;

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onEnded = () => { setPlaying(false); onBusyRef.current?.(false); onComplete?.(); };
    const onError = () => { setPlaying(false); onBusyRef.current?.(false); setPlayError(language === "en" ? "Audio could not load. Try again before continuing." : "No se pudo cargar el audio. Reintenta antes de continuar."); };
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);
    return () => { audio.removeEventListener("ended", onEnded); audio.removeEventListener("error", onError); };
  }, [onComplete, language]);
  useEffect(() => () => { onBusyRef.current?.(false); }, []);

  const play = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || playing || exhausted || startedRef.current) return;
    startedRef.current = true;
    setPlaying(true);
    setPlayError(null);
    onBusyRef.current?.(true);
    audio.currentTime = 0;
    audio.play().then(async () => {
      setPlaysUsed((n) => n + 1);
      try { await onStarted?.(); } catch { setPlayError(language === "en" ? "Playback could not be saved. Check your connection." : "No se pudo registrar la reproducción. Revisa la conexión."); }
      finally { startedRef.current = false; }
    }).catch(() => { startedRef.current = false; setPlaying(false); onBusyRef.current?.(false); });
  }, [playing, exhausted, onStarted, language]);
  useEffect(() => {
    if (!autoPlay || consumed || attemptedAutoRef.current) return;
    attemptedAutoRef.current = true;
    const timeout = setTimeout(play, 0);
    return () => { clearTimeout(timeout); attemptedAutoRef.current = false; };
  }, [autoPlay, consumed, play]);

  return (
    <div className="flex flex-col items-center gap-3 py-4">
      <audio ref={audioRef} src={src} preload="auto" />
      <button
        type="button"
        onClick={play}
        disabled={playing || exhausted}
        aria-label={language === "en" ? (playing ? "Audio playing" : "Play audio") : (playing ? "Reproduciendo audio" : "Reproducir audio")}
        className="flex size-24 items-center justify-center rounded-full transition-transform duration-200 not-disabled:hover:scale-105 disabled:opacity-40"
        style={{
          backgroundColor: "color-mix(in oklab, var(--xaccent) 16%, var(--xsurface))",
          color: "var(--xaccent2)",
        }}
      >
        {playing ? (
          <span className="flex items-end gap-1" aria-hidden>
            <span className="wave-bar h-5 w-1.5 rounded-full bg-current" />
            <span className="wave-bar h-8 w-1.5 rounded-full bg-current [animation-delay:120ms]" />
            <span className="wave-bar h-6 w-1.5 rounded-full bg-current [animation-delay:240ms]" />
            <span className="wave-bar h-9 w-1.5 rounded-full bg-current [animation-delay:360ms]" />
          </span>
        ) : (
          <svg width="36" height="36" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M11 5 6 9H2v6h4l5 4V5z" />
            <path
              d="M15.5 8.5a5 5 0 0 1 0 7M18.4 5.6a9 9 0 0 1 0 12.8"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        )}
      </button>
      {playError && <p role="alert" className="max-w-sm text-center text-sm" style={{ color: "var(--xwarn)" }}>{playError}</p>}
      {remaining !== null && (
        <p className="text-sm" style={{ color: "var(--xmuted)" }}>
          {exhausted ? (
            language === "en" ? "No plays remaining" : "Sin reproducciones restantes"
          ) : (
            <>
              <span style={{ fontFamily: "var(--xfont-display)", color: "var(--xink)", fontWeight: 600 }}>
                {remaining}
              </span>{" "}
              {language === "en" ? (remaining === 1 ? "play remaining" : "plays remaining") : `reproducci${remaining === 1 ? "ón" : "ones"} restante${remaining === 1 ? "" : "s"}`}
            </>
          )}
        </p>
      )}
    </div>
  );
}
