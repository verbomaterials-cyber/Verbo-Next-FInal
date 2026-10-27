import Link from "next/link";
import { Icon } from "./icons";
import { practiceScore, portalDate } from "@/lib/portal";
export type ActivityAttempt = { id: string; status: string; startedAt: Date; completedAt: Date | null; overallScore: unknown; examVersion: { label: string; examType: { name: string; slug: string } } };
export function AttemptActivity({ attempts }: { attempts: ActivityAttempt[] }) {
  return <ul className="activity-list">{attempts.map(attempt => {
    const score = practiceScore(attempt.overallScore, attempt.status), active = attempt.status === "IN_PROGRESS", pending = attempt.status === "PENDING_REVIEW";
    return <li className="activity-item" key={attempt.id}>
      <span className="activity-icon"><Icon name={active ? "play" : pending ? "clock" : "check"} size={19} /></span>
      <div className="activity-description"><strong>{attempt.examVersion.label}</strong><p>{attempt.examVersion.examType.name} · {portalDate(attempt.completedAt ?? attempt.startedAt, true)}</p></div>
      {score ? <p className="activity-score">{score.value}<small>{score.label}</small></p> : <span className={`status-pill ${active ? "status-pill-progress" : pending ? "status-pill-pending" : ""}`}>{active ? "En curso" : pending ? "En revisión" : "Finalizado"}</span>}
      <Link className="activity-open" href={active ? `/alumno/intento/${attempt.id}` : `/alumno/resultado/${attempt.id}`} aria-label={`${active ? "Retomar" : "Ver resultado de"} ${attempt.examVersion.label}`}>{active ? "Retomar" : "Ver resultado"}<Icon name="chevron" size={16} /></Link>
    </li>;
  })}</ul>;
}
