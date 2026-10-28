import { Brand } from "./brand";
import { PrintTeacherReport } from "./print-teacher-report";
import { portalDate } from "@/lib/portal";
import { skillLabels } from "@/lib/study-plan";
import type { PublishedReport } from "@/lib/teacher/report";

export function TeacherReportView({ report, studentName, examName, attemptId }: { report: PublishedReport; studentName: string; examName: string; attemptId: string }) {
  const { content } = report;
  const score = report.overallScore as { value?: number | null } | null;
  const subscores = Object.entries((report.subscores ?? {}) as Record<string, unknown>).filter((entry): entry is [string, number] => typeof entry[1] === "number");
  return <section className="teacher-report mt-8" id="reporte-verbo" aria-label="Reporte personalizado de tu profesor">
    <header><Brand /><span>VERBO LANGUAGE SOLUTIONS</span></header>
    <p className="report-eyebrow">TU PREPARACIÓN, CON DIRECCIÓN</p><h2>Una mirada a tu avance.</h2>
    <p className="report-student">{studentName}</p><p className="text-sm text-ink-muted">{examName}</p>
    <div className="report-scores"><div><strong>{score?.value ?? "—"}</strong><span>Resultado de práctica</span></div>{subscores.map(([name, value]) => <div key={name}><strong>{value}</strong><span>{name}</span></div>)}</div>
    {([["Tu punto de partida", content.summary], ["Lo que ya haces bien", content.strengths], ["Donde vamos a enfocarnos", content.improvements], ["Tu plan de estudio", content.studyPlan]] as const).map(([label, text]) => <div className="report-section" key={label}><h3>{label}</h3><p>{text}</p></div>)}
    {content.focusSkills.length > 0 && <p className="report-focus">Prioridades del plan: {content.focusSkills.map(s => skillLabels[s]).join(" · ")}</p>}
    {(["reading", "listening", "writing", "speaking"] as const).filter(key => content[key]).map(key => <div className="report-section" key={key}><h3>{key[0].toUpperCase() + key.slice(1)}</h3><p>{content[key]}</p></div>)}
    <footer><p>Revisado por <strong>{report.authorName}</strong> · {portalDate(new Date(report.publishedAt), true)}</p>{content.followUpDate && <p>Seguimiento: {portalDate(new Date(content.followUpDate + "T12:00:00Z"), true)}</p>}<p>Referencia: {attemptId}</p><p>Reporte de preparación de Verbo. Los resultados utilizan escalas de práctica internas; no constituyen una certificación oficial.</p></footer>
    <div className="teacher-report-actions"><PrintTeacherReport /></div>
  </section>;
}
