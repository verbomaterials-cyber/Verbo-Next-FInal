"use client";

import { signOut } from "next-auth/react";

export function SignOutButton() {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: "/login" })}
      className="rounded-lg px-3 py-1.5 text-sm text-ink-muted transition-colors duration-150 hover:bg-brand-soft hover:text-ink"
    >
      Cerrar sesión
    </button>
  );
}
