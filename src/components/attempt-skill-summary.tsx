import type { buildAttemptInsights } from "@/lib/attempt-insights";

export function AttemptSkillSummary({ insights }: { insights: ReturnType<typeof buildAttemptInsights> }) {
  return <section className="mt-7" aria-labelledby="skill-summary-title">
    <h2 id="skill-summary-title" className="text-lg font-semibold">Tu mapa de habilidades</h2>
    <p className="mt-2 text-sm text-ink-muted">Puntos obtenidos sobre los ya evaluados. Las respuestas pendientes se indican aparte; los porcentajes no equivalen a un puntaje oficial.</p>
    <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{insights.skills.map(s => <article key={s.name} className="rounded-xl border border-line bg-surface p-5">
      <div className="flex items-center justify-between gap-3"><h3 className="font-semibold">{s.name}</h3><strong className="font-mono">{s.percent === null ? "—" : `${s.percent}%`}</strong></div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-background" aria-hidden="true"><div className="h-full rounded-full bg-brand" style={{ width: `${Math.min(100, s.percent ?? 0)}%` }} /></div>
      <p className="mt-3 text-xs text-ink-muted">{Number(s.earned.toFixed(2))} / {Number((s.possible - s.pendingPoints).toFixed(2))} puntos evaluados</p>
      <p className="mt-2 text-xs leading-5">{s.correct} correctas · {s.incorrect} incorrectas{s.partial > 0 ? ` · ${s.partial} parciales` : ""}{s.omitted > 0 ? ` · ${s.omitted} sin responder` : ""}</p>
      {s.pending > 0 && <p className="mt-2 text-xs font-medium text-brand">{s.pending} por revisar · resultado parcial</p>}
      {s.unscored > 0 && <p className="mt-1 text-xs text-ink-muted">{s.unscored} sin puntuación</p>}
    </article>)}</div>
    {insights.priorities.length > 0 && <p className="mt-4 rounded-lg bg-brand-soft px-4 py-3 text-sm text-brand"><strong>Prioridad sugerida: {insights.priorities.join(" y ")}.</strong> Son las habilidades evaluadas con menor porcentaje, por debajo del 75% de los puntos de práctica. El profesor definirá el plan con estas evidencias y tu objetivo.</p>}
  </section>;
}
