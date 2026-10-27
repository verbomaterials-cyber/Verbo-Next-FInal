"use client";

/* Bandera de duda: disponible en todos los exámenes; guarda Response.isFlagged. */
export function QuestionFlag({
  flagged,
  onToggle,
}: {
  flagged: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={flagged}
      aria-label={flagged ? "Quitar marca de duda" : "Marcar como duda para tu sesión en vivo"}
      title={flagged ? "Marcada como duda" : "Marcar como duda"}
      className="flex items-center gap-1.5 px-2.5 py-1.5 text-sm transition-colors duration-150"
      style={{
        borderRadius: "min(var(--xcontrol), 12px)",
        color: flagged ? "var(--xaccent2)" : "var(--xmuted)",
        backgroundColor: flagged ? "color-mix(in oklab, var(--xaccent) 16%, transparent)" : "transparent",
      }}
    >
      <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill={flagged ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
        <line x1="4" y1="22" x2="4" y2="15" />
      </svg>
      {flagged ? "Duda marcada" : "Marcar duda"}
    </button>
  );
}
