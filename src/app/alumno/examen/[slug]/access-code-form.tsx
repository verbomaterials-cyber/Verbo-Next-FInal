"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { verifyAccessCode } from "@/lib/student/actions";
import { Button, ErrorNote, Field, Input } from "@/components/ui";

export function AccessCodeForm({ slug }: { slug: string }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if(checking)return;
    setChecking(true);
    setError(null);
    try{
    const result = await verifyAccessCode({ slug, code });
    if (!result.ok) {
      setError(result.error);
      setChecking(false);
      return;
    }
    router.refresh();
    }catch{setError("No pudimos conectar. Revisa tu conexión y vuelve a intentar.");}finally{setChecking(false);}
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Field label="Código de acceso">
        <Input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="XXXX-XXXX"
          required
          autoComplete="off"
          className="font-mono text-lg tracking-widest"
          maxLength={12}
        />
      </Field>
      <ErrorNote>{error}</ErrorNote>
      <Button type="submit" disabled={checking || code.replace(/[^A-Z0-9]/g, "").length < 8} className="w-full">
        {checking ? "Verificando…" : "Desbloquear examen"}
      </Button>
    </form>
  );
}
