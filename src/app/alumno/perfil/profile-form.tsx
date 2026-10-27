"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { updateProfile } from "@/lib/student/profile-actions";
import { ErrorNote } from "@/components/ui";
import { Icon } from "@/components/icons";
export function ProfileForm({ fullName, email }: { fullName: string; email: string }) {
  const router = useRouter();
  const [name, setName] = useState(fullName), [savedName, setSavedName] = useState(fullName), [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null), [saved, setSaved] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault(); if (busy) return; setBusy(true); setSaved(false); setError(null);
    try { const result = await updateProfile({ fullName: name }); if (!result.ok) { setError(result.error); return; } setName(result.fullName); setSavedName(result.fullName); setSaved(true); router.refresh(); }
    catch { setError("No pudimos conectar. Tu nombre sigue aquí; vuelve a intentar guardarlo."); }
    finally { setBusy(false); }
  }
  return <form className="profile-form" onSubmit={submit}>
    <label htmlFor="profile-name">Nombre completo<input id="profile-name" name="fullName" value={name} minLength={2} maxLength={100} required autoComplete="name" onChange={e => { setName(e.target.value); setSaved(false); }} disabled={busy} /><small>Así te recibiremos en tu espacio y te verá tu asesor.</small></label>
    <label htmlFor="profile-email">Correo de acceso<input id="profile-email" type="email" value={email} readOnly autoComplete="email" /><small>Para cambiar el correo o recuperar tu contraseña, contacta a tu asesor.</small></label>
    <ErrorNote>{error}</ErrorNote>{saved && <p className="inline-success" role="status"><Icon name="check" size={18} />Tu nombre se guardó correctamente.</p>}
    <button type="submit" className="next-button" disabled={busy || !name.trim() || name.trim() === savedName} aria-busy={busy}>{busy ? "Guardando…" : "Guardar cambios"}<Icon name="check" size={17} /></button>
  </form>;
}
