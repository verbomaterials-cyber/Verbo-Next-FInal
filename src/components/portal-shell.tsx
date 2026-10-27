"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Brand } from "./brand";
import { Icon, type IconName } from "./icons";
import { SignOutButton } from "./sign-out-button";

const studentLinks: { href: string; label: string; icon: IconName }[] = [
  { href: "/alumno", label: "Mi espacio", icon: "home" },
  { href: "/alumno#examenes", label: "Mis exámenes", icon: "book" },
  { href: "/alumno/resultados", label: "Resultados", icon: "chart" },
  { href: "/alumno/perfil", label: "Mi perfil", icon: "user" },
];
const adminLinks: typeof studentLinks = [
  { href: "/admin", label: "Exámenes", icon: "book" },
  { href: "/admin/alumnos", label: "Alumnos", icon: "users" },
  { href: "/admin/metricas", label: "Métricas", icon: "chart" },
];
export function PortalShell({ children, name, role }: { children: ReactNode; name: string; role: "student" | "admin" }) {
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
  const links = role === "student" ? studentLinks : adminLinks;
  const active = (href: string) => href.includes("#") ? path.startsWith("/alumno/examen") || path.startsWith("/alumno/preparacion") : href === "/alumno" || href === "/admin" ? path === href || role === "admin" && path.startsWith("/admin/examenes") : path.startsWith(href) || href.endsWith("resultados") && (path.startsWith("/alumno/resultado/") || path.startsWith("/alumno/progreso/"));
  const title = links.find(item => active(item.href))?.label ?? (path === "/alumno/ayuda" ? "Guía y ayuda" : role === "admin" ? "Administración" : "Mi espacio");
  const initials = name.trim().split(/\s+/).slice(0, 2).map(n => n[0]).join("").toUpperCase() || "V";
  return <div className="portal">
    <a href="#portal-content" className="skip-link">Ir al contenido</a>
    <aside className="portal-sidebar">
      <Brand href={role === "student" ? "/alumno" : "/admin"} inverse />
      <p className="sidebar-context">{role === "student" ? "Tu espacio de preparación" : "Espacio de administración"}</p>
      <nav aria-label="Navegación principal" className="portal-nav">{links.map(item => <Link href={item.href} key={item.href} aria-current={active(item.href) ? "page" : undefined}><Icon name={item.icon} /><span>{item.label}</span>{active(item.href) && <span className="nav-active-dot" />}</Link>)}</nav>
      <div className="sidebar-bottom"><p>Un paso más cerca<br /><strong>de tu siguiente meta.</strong></p><Link href={role === "student" ? "/alumno/ayuda" : "https://verbolanguagesolutions.com/next"}><Icon name="help" size={18} />{role === "student" ? "Guía y ayuda" : "Ver sitio Verbo"}<Icon name="arrow" size={16} /></Link><span>VERBO LANGUAGE SOLUTIONS</span></div>
    </aside>
    <div className="portal-body">
      <header className="portal-topbar"><div className="portal-mobile-brand"><Brand href={role === "student" ? "/alumno" : "/admin"} /></div><p className="portal-breadcrumb">{role === "admin" ? "Administración" : "Mi preparación"}<span>/</span><strong>{title}</strong></p>
        <details className="profile-menu" ref={menuRef} onToggle={e => setMenuOpen(e.currentTarget.open)}><summary aria-label="Abrir menú de cuenta"><span className="avatar">{initials}</span><span className="account-name">{name}<small>{role === "student" ? "Miembro de Verbo NEXT" : "Administrador"}</small></span><Icon name="chevron" size={14} className="account-chevron" /></summary><div className="account-dropdown">{role === "student" && <><Link href="/alumno/perfil" onClick={() => { if (menuRef.current) menuRef.current.open = false; }}><Icon name="user" size={17} />Mi perfil</Link><Link href="/alumno/ayuda" onClick={() => { if (menuRef.current) menuRef.current.open = false; }}><Icon name="help" size={17} />Guía y ayuda</Link></>}<SignOutButton /></div></details>
      </header>
      <main id="portal-content" className="portal-content" tabIndex={-1}><div className="portal-route" key={path}>{children}</div></main>
      <footer className="portal-footer"><span>Hecho para tu siguiente paso.</span><span>Simulación independiente · <Link href="/creditos-audio">Créditos</Link></span></footer>
    </div>
    <nav className="portal-mobile-nav" aria-label="Navegación móvil">{links.map(item => <Link key={item.href} href={item.href} aria-current={active(item.href) ? "page" : undefined}><Icon name={item.icon} size={21} /><span>{item.label}</span></Link>)}</nav>
  </div>;
}
