"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createExamType } from "@/lib/admin/actions";
import { Button, Checkbox, ErrorNote, Field, Input, Select, Textarea } from "@/components/ui";

const SCORE_SCALE_PLACEHOLDER = `{
  "type": "range",
  "min": 10,
  "max": 160,
  "step": 5,
  "label": "Puntaje"
}`;

export function NewExamForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [duration, setDuration] = useState("60");
  const [orderMode, setOrderMode] = useState<"FIXED" | "MIXED">("FIXED");
  const [adaptive, setAdaptive] = useState(false);
  const [subscores, setSubscores] = useState("");
  const [scoreScale, setScoreScale] = useState(SCORE_SCALE_PLACEHOLDER);
  const [accent, setAccent] = useState("#1E5FA8");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    let scale: Record<string, unknown>;
    try {
      scale = JSON.parse(scoreScale);
    } catch {
      setError("La escala de puntaje no es JSON válido.");
      return;
    }

    setSaving(true);
    const result = await createExamType({
      name,
      description,
      totalDurationMinutes: Number(duration),
      sectionOrderMode: orderMode,
      hasAdaptiveLogic: adaptive,
      subscoreDefinitions: subscores
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
      scoreScale: scale,
      accentColor: accent,
    });

    if (!result.ok) {
      setError(result.error);
      setSaving(false);
      return;
    }
    router.push(`/admin/examenes/${result.data!.slug}/estructura`);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <Field label="Nombre del examen">
        <Input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Cambridge B2 First" />
      </Field>

      <Field label="Descripción" help="Visible solo en el panel de administración.">
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Duración total (minutos)">
          <Input type="number" min={1} value={duration} onChange={(e) => setDuration(e.target.value)} required />
        </Field>
        <Field label="Orden de secciones">
          <Select value={orderMode} onChange={(e) => setOrderMode(e.target.value as "FIXED" | "MIXED")}>
            <option value="FIXED">Fijo — secciones en orden estricto</option>
            <option value="MIXED">Mezclado — tipos intercalados</option>
          </Select>
        </Field>
      </div>

      <Checkbox
        label="Examen adaptativo (informativo; la lógica adaptativa es fase 2)"
        checked={adaptive}
        onChange={(e) => setAdaptive(e.target.checked)}
      />

      <Field label="Subscores que reporta" help="Uno por línea, ej. Reading, Writing, Literacy…">
        <Textarea
          value={subscores}
          onChange={(e) => setSubscores(e.target.value)}
          rows={4}
          required
          placeholder={"Reading\nListening\nSpeaking\nWriting"}
        />
      </Field>

      <Field label="Escala de puntaje (JSON)" help="Describe cómo se reporta el puntaje global.">
        <Textarea
          value={scoreScale}
          onChange={(e) => setScoreScale(e.target.value)}
          rows={7}
          required
          className="font-mono text-xs"
          spellCheck={false}
        />
      </Field>

      <Field label="Color de identidad" help="Acento visual del examen; el tema completo se ajusta después en themeConfig.">
        <div className="flex items-center gap-3">
          <input
            type="color"
            value={accent}
            onChange={(e) => setAccent(e.target.value)}
            className="h-9 w-14 cursor-pointer rounded border border-line-strong bg-surface"
            aria-label="Color de identidad"
          />
          <code className="text-sm text-ink-muted">{accent}</code>
        </div>
      </Field>

      <ErrorNote>{error}</ErrorNote>

      <div className="flex gap-3 pt-2">
        <Button type="submit" disabled={saving || !name || !subscores.trim()}>
          {saving ? "Creando…" : "Crear examen"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => router.push("/admin")}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
