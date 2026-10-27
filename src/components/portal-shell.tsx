"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { Brand } from "./brand";
import { Icon, type IconName } from "./icons";
import { SignOutButton } from "./sign-out-button";

const studentLinks: { href: string; label: string; icon: IconName }[] = [
  { href: "/alumno", label: "Mi espacio", icon: "home" },
  { href: "/alumno#examenes", label: "Mis exámenes", icon: "book" },
  { href: "/alumno/resultados", label: "Resultados", icon: "chart" },
  { href: "/alumno/plan", label: "Mi plan", icon: "target" },
  { href: "/alumno/perfil", label: "Mi perfil", icon: "user" },
];
const adminLinks: typeof studentLinks = [
  { href: "/admin", label: "Mi tablero", icon: "home" },
  { href: "/admin/alumnos", label: "Alumnos", icon: "users" },
  { href: "/admin/profesores", label: "Profesores", icon: "user" },
  { href: "/admin/accesos", label: "Accesos", icon: "lock" },
  { href: "/admin/metricas", label: "Métricas", icon: "chart" },
  { href: "/admin/correos", label: "Correos", icon: "mail" },
];
const teacherLinks: typeof studentLinks = [
  { href: "/profesor", label: "Mi tablero", icon: "home" },
  { href: "/profesor/alumnos", label: "Mis alumnos", icon: "users" },
  { href: "/profesor/revisiones", label: "Revisiones", icon: "book" },
];
function NavigationHint() {
  const { pending } = useLinkStatus();
  return <><span aria-hidden="true" className={`portal-navigation-hint ${pending ? "is-pending" : ""}`} />{pending && <span role="status" className="sr-only">Cargando página…</span>}</>;
}
export function PortalShell({ children, name, role }: { children: ReactNode; name: string; role: "student" | "admin" | "teacher" }) {
  const path = usePathname(), menuRef = useRef<HTMLDetailsElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: PointerEvent) => { if (!menuRef.current?.contains(e.target as Node) && menuRef.current) menuRef.current.open = false; };
    const escape = (e: KeyboardEvent) => { if (e.key === "Escape" && menuRef.current) { menuRef.current.open = false; menuRef.current.querySelector("summary")?.focus(); } };
    document.addEventListener("pointerdown", close); document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", escape); };
  }, [menuOpen]);
  if (path.startsWith("/alumno/intento/")) return <>{children}</>;
  const links = role === "student" ? studentLinks : role === "teacher" ? teacherLinks : adminLinks;
  const home = role === "student" ? "/alumno" : role === "teacher" ? "/profesor" : "/admin";
  const active = (href: string) => href.includes("#") ? path.startsWith("/alumno/examen") || path.startsWith("/alumno/preparacion") : href === home ? path === href || role === "admin" && path.startsWith("/admin/examenes") : path.startsWith(href) || href.endsWith("revisiones") && path.startsWith("/profesor/revision/") || href.endsWith("resultados") && (path.startsWith("/alumno/resultado/") || path.startsWith("/alumno/progreso/"));
  const title = links.find(item => active(item.href))?.label ?? (path === "/alumno/ayuda" ? "Guía y ayuda" : role === "admin" ? "Administración" : "Mi espacio");
  const initials = name.trim().split(/\s+/).slice(0, 2).map(n => n[0]).join("").toUpperCase() || "V";
  return <div className="portal">
    <a href="#portal-content" className="skip-link">Ir al contenido</a>
    <aside className="portal-sidebar">
      <Brand href={home} inverse />
      <p className="sidebar-context">{role === "student" ? "Tu espacio de preparación" : role === "teacher" ? "Espacio docente" : "Espacio de administración"}</p>
      <nav aria-label="Navegación principal" className="portal-nav">{links.map(item => <Link prefetch={false} href={item.href} key={item.href} aria-current={active(item.href) ? "page" : undefined}><Icon name={item.icon} /><span>{item.label}</span><NavigationHint />{active(item.href) && <span className="nav-active-dot" />}</Link>)}</nav>
      <div className="sidebar-bottom"><p>Un paso más cerca<br /><strong>de tu siguiente meta.</strong></p><Link prefetch={false} href={role === "student" ? "/alumno/ayuda" : "https://verbolanguagesolutions.com/next"}><Icon name="help" size={18} />{role === "student" ? "Guía y ayuda" : "Ver sitio Verbo"}<Icon name="arrow" size={16} /></Link><span>VERBO LANGUAGE SOLUTIONS</span></div>
    </aside>
    <div className="portal-body">
      <header className="portal-topbar"><div className="portal-mobile-brand"><Brand href={home} /></div><p className="portal-breadcrumb">{role === "admin" ? "Administración" : role === "teacher" ? "Acompañamiento docente" : "Mi preparación"}<span>/</span><strong>{title}</strong></p>
        <details className="profile-menu" ref={menuRef} onToggle={e => setMenuOpen(e.currentTarget.open)}><summary aria-label="Abrir menú de cuenta"><span className="avatar">{initials}</span><span className="account-name">{name}<small>{role === "student" ? "Miembro de Verbo NEXT" : role === "teacher" ? "Profesor" : "Administrador"}</small></span><Icon name="chevron" size={14} className="account-chevron" /></summary><div className="account-dropdown">{role === "student" && <><Link prefetch={false} href="/alumno/perfil" onClick={() => { if (menuRef.current) menuRef.current.open = false; }}><Icon name="user" size={17} />Mi perfil</Link><Link prefetch={false} href="/alumno/ayuda" onClick={() => { if (menuRef.current) menuRef.current.open = false; }}><Icon name="help" size={17} />Guía y ayuda</Link></>}<SignOutButton /></div></details>
      </header>
      <main id="portal-content" className="portal-content" tabIndex={-1}><div className="portal-route" key={path}>{children}</div></main>
      <footer className="portal-footer"><span>Hecho para tu siguiente paso.</span><span>Simulación independiente · <Link prefetch={false} href="/creditos-audio">Créditos</Link></span></footer>
    </div>
    <nav className="portal-mobile-nav" aria-label="Navegación móvil">{links.map(item => <Link prefetch={false} key={item.href} href={item.href} aria-current={active(item.href) ? "page" : undefined}><Icon name={item.icon} size={21} /><span>{item.label}</span><NavigationHint /></Link>)}</nav>
  </div>;
}

