"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, ErrorNote, Field, Textarea, Input } from "./ui";
import { emptyReport, type ReportContent, type TeacherReport } from "@/lib/teacher/report";
import { saveTeacherReport } from "@/lib/teacher/report-actions";
import { skills, skillLabels } from "@/lib/study-plan";

const fields = [
  ["summary", "Lectura general del resultado"], ["strengths", "Fortalezas que conviene mantener"],
  ["improvements", "Áreas por reforzar y evidencia observada"], ["studyPlan", "Plan de estudio y actividades concretas"],
] as const;
export function TeacherReportForm({ attemptId, report, completed }: { attemptId: string; report: TeacherReport | null; completed: boolean }) {
  const router = useRouter();
  const [content, setContent] = useState<ReportContent>(report?.draft ?? emptyReport);
  const [revision, setRevision] = useState(report?.revision ?? 0);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  function update<K extends keyof ReportContent>(key: K, value: ReportContent[K]) { setContent(c => ({ ...c, [key]: value })); setMessage(""); }
  function save(publish: boolean) {
    setError(""); setMessage("");
    startTransition(async () => {
      try {
        const result = await saveTeacherReport({ attemptId, revision, publish, content });
        if (!result.ok) { setError(result.error); return; }
        setRevision(result.revision);
        setMessage(publish ? "Reporte publicado. El alumno ya puede verlo en sus resultados." : "Borrador guardado. El alumno solo ve la última versión publicada, si existe.");
        router.refresh();
      } catch { setError("No se pudo conectar. Tu texto sigue aquí; intenta guardarlo de nuevo."); }
    });
  }
  return <section className="mt-9 rounded-2xl border border-line bg-surface p-6" id="reporte-docente">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><span className="site-eyebrow">VERBO NEXT · ACOMPAÑAMIENTO</span><h2 className="mt-2 text-xl font-semibold">Del resultado al siguiente paso.</h2></div><span className="text-xs text-ink-muted">{report?.published ? "Hay una versión publicada" : "Aún sin publicar"}</span></div>
    <p className="mt-3 text-sm leading-6 text-ink-muted">Escribe un reporte personalizado para este intento. Guarda tus avances como borrador y publica cuando termines la evaluación. El alumno verá el reporte con la identidad de Verbo y podrá imprimirlo o guardarlo como PDF.</p>
    <form className="mt-6 space-y-5" onSubmit={e => { e.preventDefault(); save(false); }}>
      <fieldset disabled={pending} className="space-y-5">
        {fields.map(([key, label]) => <Field key={key} label={label}><Textarea rows={3} maxLength={4000} value={content[key]} onChange={e => update(key, e.target.value)} /></Field>)}
        <fieldset><legend className="text-sm font-medium">Habilidades prioritarias (hasta dos)</legend><div className="mt-3 flex flex-wrap gap-4">{skills.map(skill => <label key={skill} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={content.focusSkills.includes(skill)} disabled={!content.focusSkills.includes(skill) && content.focusSkills.length >= 2} onChange={e => update("focusSkills", e.target.checked ? [...content.focusSkills, skill] : content.focusSkills.filter(s => s !== skill))} />{skillLabels[skill]}</label>)}</div></fieldset>
        <details><summary className="cursor-pointer text-sm font-medium">Observaciones por habilidad</summary><div className="mt-4 grid gap-4 sm:grid-cols-2">{(["reading", "listening", "writing", "speaking"] as const).map(key => <Field key={key} label={key[0].toUpperCase() + key.slice(1)}><Textarea rows={3} maxLength={4000} value={content[key]} onChange={e => update(key, e.target.value)} /></Field>)}</div></details>
        <Field label="Fecha de seguimiento (opcional)"><Input type="date" value={content.followUpDate} onChange={e => update("followUpDate", e.target.value)} /></Field>
      </fieldset>
      {!completed && <p className="text-sm text-ink-muted">Puedes guardar el borrador ahora. La publicación se habilita al terminar de evaluar las respuestas pendientes.</p>}
      <ErrorNote>{error}</ErrorNote>
      <p role="status" className="text-sm text-success">{message}</p>
      <div className="flex flex-wrap gap-3"><Button type="submit" variant="outline" disabled={pending}>{pending ? "Guardando…" : "Guardar borrador"}</Button><Button type="button" disabled={pending || !completed} onClick={() => save(true)}>Publicar reporte al alumno</Button></div>
    </form>
  </section>;
}
