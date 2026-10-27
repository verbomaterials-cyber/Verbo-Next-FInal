import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Brand } from "@/components/brand";
import { Icon } from "@/components/icons";
import { NextJourney } from "@/components/next-journey";
export default async function Home() {
  const session = await getServerSession(authOptions);
  const enter = session ? session.user.role === "ADMIN" ? "/admin" : "/alumno" : "/login";
  return <main className="welcome">
    <a href="#bienvenida" className="skip-link">Ir al contenido</a>
    <header className="welcome-nav"><Brand /><div><Link className="text-link" href="#como-funciona">Conoce tu espacio</Link><Link href={enter} className="next-button">{session ? "Ir a mi espacio" : "Iniciar sesión"}<Icon name="arrow" size={17} /></Link></div></header>
    <section className="welcome-stage" id="bienvenida"><span className="welcome-orb welcome-orb-one" aria-hidden="true" /><span className="welcome-orb welcome-orb-two" aria-hidden="true" /><span className="welcome-orb welcome-orb-three" aria-hidden="true" />
      <h1>Tu próxima gran meta<br />empieza con <em>práctica.</em></h1>
      <p>Bienvenido a Verbo NEXT. Este es tu espacio para conocer el examen, encontrar tu ritmo y llegar con más confianza.</p>
      <div className="welcome-stage-actions"><Link href={enter} className="next-button">{session ? "Continuar mi preparación" : "Entrar a mi espacio"}<Icon name="arrow" size={18} /></Link><a href="#recorrido" className="text-link">Explorar el recorrido <Icon name="chevron" size={16} /></a></div>
      <span className="welcome-note">Tu acceso lo comparte contigo tu asesor de Verbo.</span>
    </section>
    <div id="recorrido"><NextJourney href={enter} /></div>
    <section className="welcome-after" id="como-funciona"><div><h2>Practica con intención.<br />Avanza con perspectiva.</h2></div><div><p>No se trata solo de terminar un simulador. Aquí puedes retomar tu práctica, revisar qué pasó y conversar con tu asesor sobre lo que sigue. Todo en el mismo espacio.</p>
      <details className="welcome-details"><summary>¿Qué encuentro dentro?<Icon name="chevron" size={17} /></summary><p>Los exámenes que tu asesor te asignó, simuladores con tiempos y tareas propios de cada formato, tu historial de resultados y la revisión de tus respuestas.</p></details>
      <details className="welcome-details"><summary>¿Cómo obtengo mi acceso?<Icon name="chevron" size={17} /></summary><p>Usa el correo y la contraseña que recibiste de Verbo. Al entrar a un examen, el código de tu asesor habilita el acceso. Si todavía no los tienes, <a className="text-link" href="https://verbolanguagesolutions.com/next">conoce el programa Verbo NEXT</a>.</p></details>
      <details className="welcome-details"><summary>¿Estos resultados son oficiales?<Icon name="chevron" size={17} /></summary><p>Son resultados de práctica para orientar tu preparación. Las respuestas abiertas requieren revisión, y los índices no equivalen a una certificación ni predicen un puntaje oficial.</p></details>
    </div></section>
    <footer className="public-footer"><span>© {new Date().getUTCFullYear()} Verbo Language Solutions</span><span>Práctica independiente de los organismos certificadores.</span><Link href="https://verbolanguagesolutions.com/privacy">Privacidad</Link></footer>
  </main>;
}
