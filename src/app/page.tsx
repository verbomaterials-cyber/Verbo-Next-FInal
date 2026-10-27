import Link from "next/link";
import { Brand } from "@/components/brand";
import { Icon } from "@/components/icons";

const steps = [
  { icon: "target" as const, title: "Encuentra tu punto de partida.", text: "Un diagnóstico para entender tus habilidades y conversar con tu asesor sobre tu objetivo." },
  { icon: "clock" as const, title: "Entrena con intención.", text: "Practica el formato, administra tu tiempo y conoce el ritmo del examen que estás preparando." },
  { icon: "chart" as const, title: "Haz visible tu avance.", text: "Revisa tus respuestas, recibe retroalimentación y guarda una constancia de tus resultados de práctica." },
];
export default function Home() {
  const enter = "/login";
  return <main className="next-site">
    <a href="#inicio" className="skip-link">Ir al contenido</a>
    <header className="site-nav"><Brand /><nav aria-label="Navegación principal"><a href="#experiencia">La experiencia</a><a href="#recorrido">Tu recorrido</a><Link href={enter} className="next-button">Iniciar sesión<Icon name="arrow" size={16} /></Link></nav></header>
    <section className="site-hero" id="inicio">
      <div className="site-hero-copy"><span className="site-eyebrow"><i />TU SIGUIENTE GRAN PASO</span><h1>Tu meta tiene<br />un siguiente<br /><em>nivel.</em></h1><p>Prepárate con estrategia. Practica con propósito. Llega al día de tu examen con la confianza de saber cómo has avanzado.</p><div className="site-actions"><Link href={enter} className="next-button">Entrar a mi preparación<Icon name="arrow" size={18} /></Link><a href="#experiencia" className="text-link">Descubre Verbo NEXT<Icon name="chevron" size={15} /></a></div><span className="site-footnote"><Icon name="lock" size={14} />Un espacio privado, preparado para ti.</span></div>
      <div className="site-hero-art" aria-label="Tu recorrido: diagnóstico, práctica y resultados"><div className="site-art-orbit" /><span className="site-float-tag"><Icon name="users" size={17} />Con acompañamiento Verbo</span><div className="site-path-card"><span className="site-eyebrow">TU PREPARACIÓN, CON DIRECCIÓN</span><h2>Un paso más cerca.</h2><p>Cada práctica cuenta una parte de tu historia.</p><ol>{["Conoce tu punto de partida", "Practica a tu ritmo", "Comprende tus resultados"].map((s, i) => <li key={s}><span>{i === 0 ? <Icon name="check" size={17} /> : `0${i + 1}`}</span><div><strong>{s}</strong><small>{["Diagnóstico y orientación", "Simulaciones y tiempo real", "Revisión con tu asesor"][i]}</small></div>{i === 0 && <span className="site-path-check"><Icon name="check" size={17} /></span>}</li>)}</ol><div className="site-card-bottom"><span>Tu siguiente versión empieza aquí.</span><Icon name="arrow" size={20} /></div></div><span className="site-float-note"><Icon name="chart" size={21} /><span>Más perspectiva.<strong>Más confianza.</strong></span></span><span className="site-art-spark" aria-hidden="true">✳</span></div>
    </section>
    <div className="site-value-strip"><span><Icon name="target" />Preparación personalizada</span><span><Icon name="clock" />Práctica con tiempos reales</span><span><Icon name="users" />Revisión y acompañamiento</span></div>
    <section id="experiencia" className="site-experience"><div><span className="site-eyebrow">MÁS ALLÁ DE UN SIMULADOR</span><h2>Practicar es el comienzo.<br /><em>Entender es lo que sigue.</em></h2></div><p>Tu certificación abre posibilidades. En Verbo NEXT tienes un lugar para conocer el formato, trabajar tu estrategia y transformar cada intento en una conversación sobre lo que sigue.</p></section>
    <section id="recorrido" className="site-steps" aria-label="Cómo funciona">{steps.map((step, i) => <article key={step.title}><div className="site-step-top"><span><Icon name={step.icon} size={25} /></span><small>0{i + 1}</small></div><h3>{step.title}</h3><p>{step.text}</p></article>)}</section>
    <section className="site-personal"><div><span className="site-eyebrow">TU META. TU RECORRIDO.</span><h2>Un espacio que se adapta<br />a tu preparación.</h2><p>Al entrar encontrarás los exámenes y simuladores que tu asesor te haya asignado. Todo lo que necesitas para concentrarte en tu propio siguiente paso.</p><a className="text-link" href="https://verbolanguagesolutions.com/next" target="_blank" rel="noreferrer">Conoce el programa Verbo NEXT<Icon name="arrow" size={17} /></a></div><ul>{["Tus accesos y simuladores en un solo lugar", "Historial de práctica y resultados por habilidad", "Retroalimentación de tus respuestas", "Constancia personal al completar la evaluación"].map(t => <li key={t}><span><Icon name="check" size={18} /></span>{t}</li>)}</ul></section>
    <section className="site-faq"><div><span className="site-eyebrow">ANTES DE ENTRAR</span><h2>Todo un poco<br /> más claro.</h2></div><div>{[
      ["¿Cómo obtengo mi acceso?", "Tu asesor de Verbo crea tu cuenta y asigna tus simuladores. Usa el correo, la contraseña y el código de acceso que te comparta. Si aún no los tienes, escríbenos a info@verbolanguagesolutions.com."],
      ["¿Voy a ver todos los exámenes?", "Tu panel muestra los exámenes que tienes asignados y las versiones disponibles para ti. Tu preparación sigue un recorrido propio."],
      ["¿Cómo se revisan mis resultados?", "Las tareas cerradas se evalúan al enviar el intento. Las respuestas que requieren una valoración del profesor quedan en revisión; el resultado general se completa cuando termina esa evaluación."],
      ["¿La constancia es una certificación oficial?", "Es una constancia de tu simulación en Verbo NEXT. Los puntajes orientan tu preparación; no son una certificación oficial ni una predicción calibrada del resultado del examen."],
    ].map(([q, a]) => <details key={q}><summary>{q}<Icon name="chevron" size={17} /></summary><p>{a}</p></details>)}</div></section>
    <section className="site-final"><span className="site-eyebrow">EL SIGUIENTE PASO ES TUYO</span><h2>Tu futuro merece<br />una buena preparación.</h2><Link href={enter} className="next-button next-button-lime">Comenzar mi recorrido<Icon name="arrow" size={18} /></Link></section>
    <footer className="public-footer"><Brand /><span>© {new Date().getUTCFullYear()} Verbo Language Solutions</span><a href="https://verbolanguagesolutions.com/privacy">Privacidad</a></footer>
  </main>;
}
