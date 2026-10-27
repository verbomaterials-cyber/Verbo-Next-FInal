import Link from "next/link";
import { buildToeflProgress, progressSections, type ProgressAttempt } from "@/lib/toefl-progress";
const dates = new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Mexico_City" });
const routeLabel = (branch: string | undefined) => branch === "upper" ? "superior" : branch === "lower" ? "inferior" : "—";
export function ToeflProgressReport({ attempts, canOpenStudentResults = true, reviewBase = "/admin/revision" }: { attempts: ProgressAttempt[]; canOpenStudentResults?: boolean; reviewBase?: string }) {
  const report = buildToeflProgress(attempts);
  return <>
    <div className="mt-7 grid gap-4 sm:grid-cols-3">
      {[{ label: "Simulaciones evaluadas", value: report.completed.length }, { label: "Por revisar", value: report.pending }, { label: "Última banda de práctica", value: report.latest?.score?.value ?? "—" }].map((card) =>
        <div key={card.label} className="rounded-2xl border border-line bg-surface p-5"><p className="text-xs text-ink-muted">{card.label}</p><p className="mt-2 text-3xl font-semibold tabular-nums">{card.value}</p></div>)}
    </div>
    <section className="mt-7 rounded-2xl border border-line bg-surface p-6">
      <h2 className="text-lg font-semibold">Avance por sección</h2>
      {!report.latest ? <p className="mt-3 text-sm leading-relaxed text-ink-muted">Cuando completes un simulador y tu profesor termine la revisión, aparecerán tus puntos por sección. El diagnóstico se conserva en el historial y no se mezcla con las simulaciones completas.</p> : <>
        <p className="mt-2 text-sm leading-relaxed text-ink-muted">{report.completed.length > 1 ? `Comparación entre tu primer resultado evaluado (${report.first!.label}) y el más reciente (${report.latest.label}).` : "Este es tu punto de partida. La comparación aparecerá después de una segunda simulación evaluada."}</p>
        <div className="mt-6 grid gap-6 sm:grid-cols-2">{report.changes.map((row) => <div key={row.section}>
          <div className="mb-2 flex items-center justify-between gap-3"><h3 className="text-sm font-medium">{row.section}</h3><span className="font-mono text-sm">{row.latest}/{row.possible}</span></div>
          <div role="meter" aria-label={`${row.section}: puntos más recientes`} aria-valuenow={row.latest ?? 0} aria-valuemin={0} aria-valuemax={row.possible ?? 1} className="h-2 overflow-hidden rounded-full bg-background"><div className="h-full rounded-full bg-brand" style={{ width: `${100 * (row.latest ?? 0) / (row.possible ?? 1)}%` }} /></div>
          {row.delta !== null && <><div role="meter" aria-label={`${row.section}: primer resultado`} aria-valuenow={row.first ?? 0} aria-valuemin={0} aria-valuemax={row.possible ?? 1} className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-background"><div className="h-full rounded-full bg-slate-400" style={{ width: `${100 * (row.first ?? 0) / (row.possible ?? 1)}%` }} /></div><p className="mt-2 text-xs text-ink-muted">Primero: {row.first}/{row.possible} · Cambio: {row.delta > 0 ? "+" : ""}{row.delta} puntos</p></>}
        </div>)}</div>
        {report.completed.length > 1 && <p className="mt-5 text-xs text-ink-muted">Azul: resultado más reciente · Gris: primer resultado</p>}
      </>}
    </section>
    <section className="mt-8">
      <h2 className="text-lg font-semibold">Historial de resultados</h2>
      {report.history.length === 0 ? <p className="mt-3 rounded-xl border border-dashed border-line p-6 text-sm text-ink-muted">Aún no has enviado un intento. Los exámenes en curso no se cuentan como resultados.</p> : <div className="mt-4 overflow-x-auto rounded-xl border border-line bg-surface">
        <table className="w-full min-w-[760px] text-left text-sm"><caption className="sr-only">Resultados por intento y sección de TOEFL</caption>
          <thead className="border-b border-line bg-background text-xs text-ink-muted"><tr><th scope="col" className="px-4 py-3">Versión y fecha</th>{progressSections.map((name) => <th key={name} scope="col" className="px-3 py-3">{name}</th>)}<th scope="col" className="px-3 py-3">Banda de práctica</th><th scope="col" className="px-4 py-3">Estado</th></tr></thead>
          <tbody>{[...report.history].reverse().map((attempt) => <tr key={attempt.id} className="border-b border-line last:border-0">
            <th scope="row" className="px-4 py-4 font-normal">{canOpenStudentResults ? <Link href={`/alumno/resultado/${attempt.id}`} className="font-medium text-brand underline-offset-4 hover:underline">{attempt.label}</Link> : <Link href={`${reviewBase}/${attempt.id}`} className="font-medium text-brand">{attempt.label}</Link>}<span className="mt-1 block text-xs text-ink-muted">{dates.format(attempt.completedAt ?? attempt.startedAt)}</span></th>
            {progressSections.map((section) => { const points = attempt.score?.raw[section]; return <td key={section} className="px-3 py-4 tabular-nums">{points ? points.pending ? <span className="text-xs text-ink-muted">Por revisar</span> : `${points.earned}/${points.possible}` : "—"}</td>; })}
            <td className="px-3 py-4 tabular-nums">{attempt.score?.value ?? "—"}</td>
            <td className="px-4 py-4 text-xs text-ink-muted">{!attempt.score ? "Diagnóstico / otro formato" : attempt.status === "PENDING_REVIEW" ? "Revisión pendiente" : "Evaluado"}{attempt.score?.routes && <span className="mt-1 block">R: {routeLabel(attempt.score.routes.Reading?.branch)} · L: {routeLabel(attempt.score.routes.Listening?.branch)}</span>}</td>
          </tr>)}</tbody>
        </table>
      </div>}
      <p className="mt-4 text-xs leading-relaxed text-ink-muted">Las bandas son resultados de práctica sin calibrar. La ruta de dificultad puede cambiar entre intentos; interpreta los cambios con tu asesor. Las respuestas pendientes no se comparan como resultados definitivos.</p>
    </section>
  </>;
}
