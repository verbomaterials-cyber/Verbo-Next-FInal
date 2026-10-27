"use client";

/*
 * <ExamTimer> — presentacional; el motor controla los segundos.
 * style "bar":  línea fina superior (DET, discreta, sin ansiedad).
 * style "clock": reloj MM:SS en chip hairline (TOEFL, con advertencia).
 * Ambos leen las variables de tema; sin lógica por examen.
 */

export function ExamTimer({
  style,
  totalSeconds,
  remainingSeconds,
  warnUnderSeconds,
}: {
  style: "bar" | "clock";
  totalSeconds: number;
  remainingSeconds: number;
  warnUnderSeconds: number;
}) {
  const warning = remainingSeconds <= warnUnderSeconds;

  if (style === "bar") {
    const pct = totalSeconds > 0 ? Math.max(0, (remainingSeconds / totalSeconds) * 100) : 0;
    return (
      <div
        className="fixed inset-x-0 top-0 z-10 h-[3px]"
        style={{ backgroundColor: "var(--xline)" }}
        role="timer"
        aria-label={`Tiempo restante: ${formatTime(remainingSeconds)}`}
      >
        <div
          className="h-full rounded-r-full transition-[width] duration-1000 ease-linear"
          style={{
            width: `${pct}%`,
            backgroundColor: warning ? "var(--xwarn)" : "var(--xaccent)",
          }}
        />
      </div>
    );
  }

  return (
    <div
      role="timer"
      aria-label={`Tiempo restante: ${formatTime(remainingSeconds)}`}
      className="fixed top-4 right-5 z-10 flex items-center gap-2 rounded-lg border px-3 py-1.5"
      style={{
        borderColor: warning ? "var(--xwarn)" : "var(--xline)",
        backgroundColor: "var(--xsurface)",
      }}
    >
      <span className="text-[0.62rem] tracking-wide uppercase" style={{ color: "var(--xmuted)" }}>
        Tiempo
      </span>
      <span
        className="text-sm font-semibold tabular-nums"
        style={{
          fontFamily: "var(--xfont-body)",
          color: warning ? "var(--xwarn)" : "var(--xink)",
        }}
      >
        {formatTime(remainingSeconds)}
      </span>
    </div>
  );
}

export function formatTime(seconds: number): string {
  const s = Math.max(0, seconds);
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}
