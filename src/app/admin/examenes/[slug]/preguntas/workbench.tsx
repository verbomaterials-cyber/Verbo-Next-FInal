"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  bulkCreateQuestions,
  createQuestion,
  deleteQuestion,
  updateQuestion,
} from "@/lib/admin/actions";
import type { AdminFieldSchema } from "@/lib/exam-config";
import {
  Badge,
  Button,
  ErrorNote,
  Field,
  Modal,
  Select,
  Textarea,
} from "@/components/ui";
import { DynamicFields, type QuestionValues } from "./dynamic-fields";

type VersionRow = { id: string; label: string; hasFeedback: boolean; isPublished: boolean };
type TypeRow = { id: string; name: string; isScored: boolean; adminFieldSchema: AdminFieldSchema };
type SectionRow = { name: string; questionTypes: TypeRow[] };
type QuestionRow = {
  id: string;
  order: number;
  typeName: string;
  questionTypeId: string;
  promptContent: Record<string, unknown>;
  correctAnswer: Record<string, unknown> | null;
  feedbackText: string | null;
  difficultyLevel: number | null;
};

export function QuestionWorkbench({
  slug,
  versions,
  selectedVersionId,
  sections,
  selectedTypeId,
  questions,
}: {
  slug: string;
  versions: VersionRow[];
  selectedVersionId: string | null;
  sections: SectionRow[];
  selectedTypeId: string | null;
  questions: QuestionRow[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<QuestionRow | "new" | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const version = versions.find((v) => v.id === selectedVersionId) ?? null;
  const allTypes = sections.flatMap((s) => s.questionTypes);
  const type = allTypes.find((t) => t.id === selectedTypeId) ?? null;

  function navigate(versionId: string | null, typeId: string | null) {
    const qs = new URLSearchParams();
    if (versionId) qs.set("version", versionId);
    if (typeId) qs.set("tipo", typeId);
    router.push(`/admin/examenes/${slug}/preguntas?${qs.toString()}`);
  }

  async function handleDelete(q: QuestionRow) {
    if (!confirm(`¿Eliminar la pregunta #${q.order} (${q.typeName})?`)) return;
    const result = await deleteQuestion(q.id, slug);
    if (!result.ok) setError(result.error);
    else {
      setError(null);
      router.refresh();
    }
  }

  if (versions.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-line-strong px-8 py-12 text-center text-sm text-ink-muted">
        Crea al menos una versión en el tab “Versiones” para poder cargar preguntas.
      </p>
    );
  }

  return (
    <div className="rise-in space-y-6">
      <div className="flex flex-wrap items-end gap-4">
        <Field label="Versión">
          <Select
            value={selectedVersionId ?? ""}
            onChange={(e) => navigate(e.target.value, selectedTypeId)}
            className="w-52"
          >
            {versions.map((v) => (
              <option key={v.id} value={v.id}>
                {v.label}
                {v.hasFeedback ? "" : " (sin feedback)"}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Tipo de pregunta">
          <Select
            value={selectedTypeId ?? ""}
            onChange={(e) => navigate(selectedVersionId, e.target.value || null)}
            className="w-72"
          >
            <option value="">Todos los tipos</option>
            {sections.map((s) => (
              <optgroup key={s.name} label={s.name}>
                {s.questionTypes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </Select>
        </Field>

        <div className="ml-auto flex gap-2">
          <Button variant="outline" onClick={() => setBulkOpen(true)} disabled={!version}>
            Carga masiva (JSON)
          </Button>
          <Button onClick={() => setEditing("new")} disabled={!version || !type}>
            + Nueva pregunta
          </Button>
        </div>
      </div>

      {!type && (
        <p className="text-sm text-ink-muted">
          Elige un tipo de pregunta para capturar una nueva; la tabla muestra{" "}
          {selectedTypeId ? "las preguntas de ese tipo" : "todas las preguntas de la versión"}.
        </p>
      )}

      <ErrorNote>{error}</ErrorNote>

      {questions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line-strong px-8 py-12 text-center">
          <p className="text-sm text-ink-muted">
            Sin preguntas en {version?.label ?? "esta versión"}
            {type ? ` para ${type.name}` : ""}.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line bg-surface">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-ink-muted">
                <th className="px-4 py-2.5 font-medium">#</th>
                <th className="px-4 py-2.5 font-medium">Tipo</th>
                <th className="px-4 py-2.5 font-medium">Contenido</th>
                <th className="px-4 py-2.5 font-medium">Dificultad</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {questions.map((q) => (
                <tr key={q.id}>
                  <td className="px-4 py-2.5 font-mono text-ink-muted">{q.order}</td>
                  <td className="px-4 py-2.5">
                    <Badge tone="brand">{q.typeName}</Badge>
                  </td>
                  <td className="max-w-md truncate px-4 py-2.5 text-ink-muted">
                    {excerpt(q.promptContent)}
                  </td>
                  <td className="px-4 py-2.5 text-ink-muted">{q.difficultyLevel ?? "—"}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => setEditing(q)}>
                        Editar
                      </Button>
                      <Button variant="danger" size="sm" onClick={() => handleDelete(q)}>
                        Eliminar
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && version && (
        <QuestionFormModal
          slug={slug}
          version={version}
          type={
            editing === "new" ? type! : (allTypes.find((t) => t.id === editing.questionTypeId) ?? type!)
          }
          editing={editing === "new" ? undefined : editing}
          onClose={() => setEditing(null)}
        />
      )}

      {bulkOpen && version && (
        <BulkUploadModal slug={slug} version={version} onClose={() => setBulkOpen(false)} />
      )}
    </div>
  );
}

function excerpt(prompt: Record<string, unknown>): string {
  for (const value of Object.values(prompt)) {
    if (typeof value === "string" && value.trim()) return value;
  }
  return JSON.stringify(prompt).slice(0, 80);
}

/* ───────────── Modal captura/edición ───────────── */

function QuestionFormModal({
  slug,
  version,
  type,
  editing,
  onClose,
}: {
  slug: string;
  version: VersionRow;
  type: TypeRow;
  editing?: QuestionRow;
  onClose: () => void;
}) {
  const router = useRouter();
  const [values, setValues] = useState<QuestionValues>({
    prompt: editing?.promptContent ?? {},
    answer: editing?.correctAnswer ?? {},
  });
  const [feedback, setFeedback] = useState(editing?.feedbackText ?? "");
  const [difficulty, setDifficulty] = useState(editing?.difficultyLevel?.toString() ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const answer = Object.keys(values.answer).length > 0 ? values.answer : null;
    const input = {
      slug,
      examVersionId: version.id,
      questionTypeId: type.id,
      promptContent: values.prompt,
      correctAnswer: answer,
      feedbackText: feedback.trim() || null,
      difficultyLevel: difficulty ? Number(difficulty) : null,
    };

    const result = editing ? await updateQuestion(editing.id, input) : await createQuestion(input);
    if (!result.ok) {
      setError(result.error);
      setSaving(false);
      return;
    }
    router.refresh();
    onClose();
  }

  return (
    <Modal
      open
      onClose={onClose}
      wide
      title={
        editing
          ? `Editar pregunta #${editing.order} — ${type.name}`
          : `Nueva pregunta — ${type.name} → ${version.label}`
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {!type.isScored && (
          <p className="rounded-lg bg-brand-soft px-3.5 py-2.5 text-sm text-brand">
            Este tipo no se califica automáticamente: la respuesta del alumno se
            revisa en su sesión en vivo.
          </p>
        )}

        <DynamicFields fields={type.adminFieldSchema.fields} values={values} onChange={setValues} />

        <div className="grid grid-cols-2 gap-4">
          <Field label="Dificultad (1–5)" help="Opcional; se usará en la fase adaptativa.">
            <Select value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
              <option value="">Sin definir</option>
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        {version.hasFeedback && (
          <Field
            label="Feedback"
            help="Explica por qué la respuesta es correcta/incorrecta. Se muestra al alumno al terminar."
          >
            <Textarea rows={3} value={feedback} onChange={(e) => setFeedback(e.target.value)} />
          </Field>
        )}

        <ErrorNote>{error}</ErrorNote>

        <div className="flex gap-3 pt-1">
          <Button type="submit" disabled={saving}>
            {saving ? "Guardando…" : editing ? "Guardar cambios" : "Crear pregunta"}
          </Button>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/* ───────────── Modal carga masiva ───────────── */

const BULK_EXAMPLE = `{
  "questions": [
    {
      "questionType": "Listen and Type",
      "prompt": { "audioUrl": "https://…/audio1.mp3" },
      "answer": { "transcript": "The weather is nice today." },
      "feedback": "Se evalúa la transcripción exacta.",
      "difficulty": 2
    }
  ]
}`;

/** Cada item puede venir como { questions: [...] } o como array directo. */
function extractQuestions(parsed: unknown): unknown[] {
  if (Array.isArray(parsed)) return parsed;
  if (parsed && typeof parsed === "object" && Array.isArray((parsed as { questions?: unknown }).questions)) {
    return (parsed as { questions: unknown[] }).questions;
  }
  throw new Error("no tiene la forma { questions: [...] } ni es un array");
}

function BulkUploadModal({
  slug,
  version,
  onClose,
}: {
  slug: string;
  version: VersionRow;
  onClose: () => void;
}) {
  const router = useRouter();
  const [json, setJson] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [filesSummary, setFilesSummary] = useState<string | null>(null);

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    setError(null);
    setFilesSummary(null);
    const files = Array.from(fileList);
    try {
      const merged: unknown[] = [];
      for (const file of files) {
        const text = await file.text();
        let parsed: unknown;
        try {
          parsed = JSON.parse(text);
        } catch {
          throw new Error(`"${file.name}" no es JSON válido.`);
        }
        try {
          merged.push(...extractQuestions(parsed));
        } catch (e) {
          throw new Error(`"${file.name}" ${(e as Error).message}.`);
        }
      }
      setJson(JSON.stringify({ questions: merged }, null, 2));
      setFilesSummary(
        `${files.length} archivo(s) combinado(s) → ${merged.length} pregunta(s) en total. Revisa abajo antes de importar.`,
      );
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setResult(null);

    const res = await bulkCreateQuestions({ slug, examVersionId: version.id, json });
    if (!res.ok) {
      setError(res.error);
      setSaving(false);
      return;
    }
    setResult(`Se importaron ${res.data!.created} pregunta(s) a ${version.label}.`);
    setSaving(false);
    setJson("");
    setFilesSummary(null);
    router.refresh();
  }

  return (
    <Modal open onClose={onClose} wide title={`Carga masiva → ${version.label}`}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm leading-relaxed text-ink-muted">
          Sube uno o varios archivos JSON — uno por actividad, o ya combinados —
          y se juntan en un solo lote. También puedes pegar el JSON directo
          abajo. El formato completo está documentado en{" "}
          <code className="font-mono text-xs">docs/carga-masiva.md</code> del
          repositorio; cada pregunta se valida contra el esquema de campos de
          su tipo antes de importarse (todo o nada).
        </p>

        <Field label="Archivos JSON (uno por actividad, o varios a la vez)">
          <input
            type="file"
            accept="application/json,.json"
            multiple
            onChange={(e) => handleFiles(e.target.files)}
            className="block w-full cursor-pointer rounded-lg border border-dashed border-line-strong bg-background px-3 py-2.5 text-sm text-ink-muted transition-colors duration-150 ease-(--ease-out) file:mr-3 file:rounded-md file:border-0 file:bg-brand-soft file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-brand hover:border-brand"
          />
        </Field>
        {filesSummary && (
          <p className="rounded-lg bg-brand-soft px-3.5 py-2.5 text-sm text-brand">{filesSummary}</p>
        )}

        <details className="rounded-lg border border-line bg-background px-4 py-3 text-sm">
          <summary className="cursor-pointer font-medium">Ver ejemplo de un archivo</summary>
          <pre className="mt-3 overflow-x-auto font-mono text-xs leading-relaxed text-ink-muted">
            {BULK_EXAMPLE}
          </pre>
        </details>

        <Textarea
          rows={12}
          value={json}
          onChange={(e) => setJson(e.target.value)}
          required
          spellCheck={false}
          className="font-mono text-xs"
          placeholder='{ "questions": [ … ] }'
        />

        <ErrorNote>{error}</ErrorNote>
        {result && (
          <p className="rounded-lg bg-brand-soft px-3.5 py-2.5 text-sm text-success">{result}</p>
        )}

        <div className="flex gap-3 pt-1">
          <Button type="submit" disabled={saving || !json.trim()}>
            {saving ? "Importando…" : "Importar"}
          </Button>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      </form>
    </Modal>
  );
}
