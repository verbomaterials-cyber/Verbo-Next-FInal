"use client";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { getSession, signIn } from "next-auth/react";
import { ErrorNote } from "@/components/ui";
import { Icon } from "@/components/icons";
import { roleHome, safeCallbackPath } from "@/lib/portal";
export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState(""), [password, setPassword] = useState(""), [visible, setVisible] = useState(false);
  const [error, setError] = useState<string | null>(null), [loading, setLoading] = useState(false);
  useEffect(() => {
    // The public form can be served by the CDN. Validate an existing session
    // separately before redirecting; invalid/suspended cookies cannot loop.
    let mounted = true;
    getSession().then(session => { if (mounted && session) router.replace(roleHome(session.user.role)); }).catch(() => {});
    return () => { mounted = false; };
  }, [router]);
  async function submit(e: FormEvent) {
    e.preventDefault(); if (loading) return; setError(null); setLoading(true);
    try {
      const result = await signIn("credentials", { email, password, redirect: false });
      if (!result || result.error || !result.ok) { setError("No pudimos entrar con esos datos. Revisa tu correo y contraseña e inténtalo de nuevo."); setLoading(false); return; }
      router.push(safeCallbackPath(new URL(window.location.href).searchParams.get("callbackUrl"))); router.refresh();
    } catch { setError("No pudimos conectar. Comprueba tu conexión e inténtalo de nuevo."); setLoading(false); }
  }
  return <form onSubmit={submit} className="signin-form">
    <div><label htmlFor="email">Correo electrónico</label><div className="signin-input-wrap"><Icon name="mail" size={19} /><input id="email" name="email" type="email" autoComplete="email" required disabled={loading} value={email} onChange={e => setEmail(e.target.value)} placeholder="tu@correo.com" aria-invalid={!!error} /></div></div>
    <div><label htmlFor="password">Contraseña</label><div className="signin-input-wrap"><Icon name="lock" size={19} /><input id="password" name="password" type={visible ? "text" : "password"} autoComplete="current-password" required disabled={loading} value={password} onChange={e => setPassword(e.target.value)} placeholder="Tu contraseña" aria-invalid={!!error} /><button type="button" className="password-toggle" aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"} aria-pressed={visible} onClick={() => setVisible(!visible)}><Icon name="eye" size={19} /></button></div></div>
    <ErrorNote>{error}</ErrorNote><button type="submit" className="next-button" disabled={loading || !email.trim() || !password} aria-busy={loading}>{loading ? "Abriendo tu espacio…" : "Entrar a mi espacio"}<Icon name="arrow" size={18} /></button>
  </form>;
}
