"use client";
import { useState } from "react";
import Link from "next/link";
import { ExamMark } from "./brand";
import { Icon } from "./icons";

const content = {
  det: { name: "Duolingo English Test", short: "DET", summary: "Ritmo ágil. Una tarea a la vez.", tasks: ["Lectura y escucha interactivas", "Escritura en dos etapas", "Conversación y muestras orales"] },
  "toefl-ibt": { name: "TOEFL iBT", short: "TOEFL", summary: "Cuatro habilidades. Un recorrido completo.", tasks: ["Reading y Listening por módulos", "Oraciones, email y discusión", "Repetición y entrevista oral"] },
};
export function NextJourney({ href }: { href: string }) {
  const [exam, setExam] = useState<keyof typeof content>("det");
  const selected = content[exam];
  return <section className="journey" aria-labelledby="journey-title">
    <div className="journey-heading"><h2 id="journey-title">Cada meta tiene su recorrido.</h2><div className="exam-switch" role="group" aria-label="Explora un examen">{Object.entries(content).map(([key, item]) => <button key={key} type="button" aria-pressed={key === exam} onClick={() => setExam(key as keyof typeof content)}>{item.short}</button>)}</div></div>
    <div className="journey-body" key={exam}><div className="journey-exam"><ExamMark slug={exam} name={selected.name} large /><div><h3>{selected.name}</h3><p>{selected.summary}</p></div></div><ol className="journey-steps"><li><span className="journey-node"><Icon name="target" /></span><div><h3>Encuentra tu punto de partida</h3><p>Un diagnóstico para saber dónde enfocar tu preparación.</p></div></li><li><span className="journey-node"><Icon name="play" /></span><div><h3>Entra en ritmo</h3><p>{selected.tasks.join(" · ")}.</p></div></li><li><span className="journey-node"><Icon name="chart" /></span><div><h3>Vuelve con una nueva perspectiva</h3><p>Consulta tus resultados y trabaja la revisión con tu asesor.</p></div></li></ol></div>
    <Link href={href} className="journey-link">Empezar mi preparación <Icon name="arrow" /></Link>
  </section>;
}
