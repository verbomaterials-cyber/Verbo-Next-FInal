"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createVersion, deleteVersion, updateVersion } from "@/lib/admin/actions";
import { Badge, Button, Checkbox, ErrorNote, Field, Input, Modal } from "@/components/ui";

type VersionRow = {
  id: string;
  label: string;
  hasFeedback: boolean;
  isPublished: boolean;
  questionCount: number;
  attemptCount: number;
};

export function VersionsManager({
  slug,
  examTypeId,
  versions,
}: {
  slug: string;
  examTypeId: string;
  versions: VersionRow[];
}) {
  const router = useRouter();
  const [modal, setModal] = useState<null | { editing?: VersionRow }>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function togglePublished(v: VersionRow) {
    setBusy(v.id);
    const result = await updateVersion(v.id, slug, { isPublished: !v.isPublished });
    if (!result.ok) setError(result.error);
    else setError(null);
    setBusy(null);
    router.refresh();
  }

  async function handleDelete(v: VersionRow) {
    if (
      !confirm(
        `¿Eliminar "${v.label}"? Sus ${v.questionCount} pregunta(s) se eliminarán también.`,
      )
    )
      return;
    const result = await deleteVersion(v.id, slug);
    if (!result.ok) setError(result.error);
    else setError(null);
    router.refresh();
  }

  return (
    <div className="rise-in space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-prose text-sm leading-relaxed text-ink-muted">
          Solo las versiones publicadas son visibles para los alumnos (según su
          enrollment). El Diagnóstico típicamente no lleva feedback.
        </p>
        <Button onClick={() => setModal({})}>+ Nueva versión</Button>
      </div>

      <ErrorNote>{error}</ErrorNote>

      <div className="overflow-x-auto rounded-xl border border-line bg-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs text-ink-muted">
              <th className="px-4 py-2.5 font-medium">Versión</th>
              <th className="px-4 py-2.5 font-medium">Feedback</th>
              <th className="px-4 py-2.5 font-medium">Preguntas</th>
              <th className="px-4 py-2.5 font-medium">Intentos</th>
              <th className="px-4 py-2.5 font-medium">Estado</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {versions.map((v) => (
              <tr key={v.id}>
                <td className="px-4 py-3 font-medium">{v.label}</td>
                <td className="px-4 py-3">
                  {v.hasFeedback ? <Badge tone="success">con feedback</Badge> : <Badge>sin feedback</Badge>}
                </td>
                <td className="px-4 py-3 text-ink-muted">{v.questionCount}</td>
                <td className="px-4 py-3 text-ink-muted">{v.attemptCount}</td>
                <td className="px-4 py-3">
                  {v.isPublished ? <Badge tone="brand">publicada</Badge> : <Badge>borrador</Badge>}
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busy === v.id}
                      onClick={() => togglePublished(v)}
                    >
                      {v.isPublished ? "Despublicar" : "Publicar"}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setModal({ editing: v })}>
                      Editar
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      disabled={v.attemptCount > 0}
                      title={v.attemptCount > 0 ? "Tiene intentos de alumnos" : undefined}
                      onClick={() => handleDelete(v)}
                    >
                      Eliminar
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <VersionForm
          slug={slug}
          examTypeId={examTypeId}
          editing={modal.editing}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}

function VersionForm({
  slug,
  examTypeId,
  editing,
  onClose,
}: {
  slug: string;
  examTypeId: string;
  editing?: VersionRow;
  onClose: () => void;
}) {
  const router = useRouter();
  const [label, setLabel] = useState(editing?.label ?? "");
  const [hasFeedback, setHasFeedback] = useState(editing?.hasFeedback ?? true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    const result = editing
      ? await updateVersion(editing.id, slug, { label, hasFeedback })
      : await createVersion({ examTypeId, slug, label, hasFeedback });
    if (!result.ok) {
      setError(result.error);
      setSaving(false);
      return;
    }
    router.refresh();
    onClose();
  }

  return (
    <Modal open onClose={onClose} title={editing ? "Editar versión" : "Nueva versión"}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Etiqueta">
          <Input value={label} onChange={(e) => setLabel(e.target.value)} required placeholder="Simulador 4" />
        </Field>
        <Checkbox
          label="Incluye feedback por pregunta (el Diagnóstico va sin feedback)"
          checked={hasFeedback}
          onChange={(e) => setHasFeedback(e.target.checked)}
        />
        <ErrorNote>{error}</ErrorNote>
        <div className="flex gap-3 pt-1">
          <Button type="submit" disabled={saving || !label}>
            {saving ? "Guardando…" : "Guardar"}
          </Button>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
        </div>
      </form>
    </Modal>
  );
}
