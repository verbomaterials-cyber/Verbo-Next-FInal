import Link from "next/link";
import { Brand } from "./brand";
import { Icon } from "./icons";
import { LoginForm } from "@/app/login/login-form";

export function SignInView() {
  return <main className="signin">
    <section className="signin-story"><Brand inverse /><div className="signin-story-copy"><h2>El siguiente paso<br />es <span>tuyo.</span></h2><p>Tu práctica, tus avances y un espacio para llegar con más confianza al día del examen.</p></div><div className="signin-story-footer"><span><Icon name="target" size={16} />Práctica con propósito</span><span><Icon name="users" size={16} />Acompañamiento Verbo</span></div><div className="signin-orbit" aria-hidden="true" /></section>
    <section className="signin-main"><div className="signin-form-wrap"><div className="signin-mobile-brand"><Brand /></div><Link href="/" className="signin-back"><Icon name="arrow" size={15} />Volver a la bienvenida</Link><h1>Qué bueno verte.</h1><p className="signin-intro">Entra a tu espacio y continúa desde donde te quedaste.</p><LoginForm /><p className="signin-help">¿Aún no tienes acceso o necesitas recuperar tu contraseña?<br /><a href="mailto:info@verbolanguagesolutions.com?subject=Ayuda%20con%20mi%20acceso%20a%20Verbo%20NEXT">Escríbenos para ayudarte</a>.</p></div><p className="signin-legal">Acceso privado de Verbo Language Solutions.<br />Las simulaciones son independientes de los exámenes oficiales.</p></section>
  </main>;
}
