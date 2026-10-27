import Link from "next/link";
import { Brand } from "./brand";
import { Icon } from "./icons";
import { LoginForm } from "@/app/login/login-form";
export function SignInView() {
  return <main className="login-scene"><header className="login-nav"><Brand /><Link href="/" className="text-link"><Icon name="arrow" size={16} />Volver al inicio</Link></header>
    <div className="login-layout"><section className="login-invitation"><span className="site-eyebrow">TU ESPACIO VERBO NEXT</span><h2>Lo que viene<br /> empieza <em>contigo.</em></h2><p>Un nuevo intento. Una nueva perspectiva.<br />Un paso más cerca de tu meta.</p><div className="login-mini-journey"><span><Icon name="target" size={19} /></span><i /><span><Icon name="book" size={19} /></span><i /><span><Icon name="chart" size={19} /></span></div><small>Practica · Comprende · Avanza</small><div className="login-deco" aria-hidden="true">N<span>EXT.</span></div></section>
    <section className="login-card"><span className="login-card-icon"><Icon name="lock" size={22} /></span><h1>Qué bueno verte<span>.</span></h1><p className="signin-intro">Entra y continúa tu preparación.</p><LoginForm /><p className="signin-help">¿Necesitas ayuda con tu acceso?<br /><a href="mailto:info@verbolanguagesolutions.com?subject=Acceso%20Verbo%20NEXT">Estamos para acompañarte<Icon name="arrow" size={14} /></a></p></section></div>
    <footer className="login-footer"><span>© {new Date().getUTCFullYear()} Verbo Language Solutions</span><span>Tu siguiente paso, en un espacio privado.</span></footer>
  </main>;
}

