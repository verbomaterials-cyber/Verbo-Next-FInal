"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  createSection,
  updateSection,
  deleteSection,
  createQuestionType,
  updateQuestionType,
  deleteQuestionType,
} from "@/lib/admin/actions";
import {
  ADMIN_FIELD_SCHEMA_TEMPLATE,
  adminFieldSchemaZ,
} from "@/lib/exam-config";
import {
  Badge,
  Button,
  Checkbox,
  ErrorNote,
  Field,
  Input,
  Modal,
  Select,
} from "@/components/ui";
import { Textarea } from "@/components/ui";

const SKILLS = ["READING", "WRITING", "LISTENING", "SPEAKING"] as const;
const SKILL_LABEL: Record<string, string> = {
  READING: "Reading",
  WRITING: "Writing",
  LISTENING: "Listening",
  SPEAKING: "Speaking",
};

type QuestionTypeRow = {
  id: string;
  name: string;
  inputMedia: string;
  responseType: string;
  timingMode: string;
  timePerItemSeconds: number | null;
  prepTimeSeconds: number | null;
  replaysAllowed: number | null;
  isScored: boolean;
  subscoreMapping: string[];
  adminFieldSchema: string;
  questionCount: number;
};

type SectionRow = {
  id: string;
  name: string;
  order: number | null;
  durationMinutes: number;
  skillsMeasured: string[];
  questionTypes: QuestionTypeRow[];
};

export function StructureManager({
  slug,
  examTypeId,
  sectionOrderMode,
  subscoreDefinitions,
  sections,
}: {
  slug: string;
  examTypeId: string;
  sectionOrderMode: "FIXED" | "MIXED";
  subscoreDefinitions: string[];
  sections: SectionRow[];
}) {
  const router = useRouter();
  const [sectionModal, setSectionModal] = useState<null | { editing?: SectionRow }>(null);
  const [typeModal, setTypeModal] = useState<null | {
    sectionId: string;
    sectionName: string;
    editing?: QuestionTypeRow;
  }>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleDeleteSection(section: SectionRow) {
    if (!confirm(`¿Eliminar la sección "${section.name}" y sus tipos de pregunta?`)) return;
    const result = await deleteSection(section.id, slug);
    if (!result.ok) setError(result.error);
    else {
      setError(null);
      router.refresh();
    }
  }

  async function handleDeleteType(qt: QuestionTypeRow) {
    if (!confirm(`¿Eliminar el tipo de pregunta "${qt.name}"?`)) return;
    const result = await deleteQuestionType(qt.id, slug);
    if (!result.ok) setError(result.error);
    else {
      setError(null);
      router.refresh();
    }
  }

  return (
    <div className="rise-in space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-prose text-sm leading-relaxed text-ink-muted">
          {sectionOrderMode === "FIXED"
            ? "Las secciones se presentan al alumno en el orden indicado."
            : "Este examen intercala tipos de pregunta: las secciones agrupan, no ordenan."}
        </p>
        <Button onClick={() => setSectionModal({})}>+ Nueva sección</Button>
      </div>

      <ErrorNote>{error}</ErrorNote>

      {sections.length === 0 && (
        <div className="rounded-xl border border-dashed border-line-strong px-8 py-12 text-center">
          <p className="text-sm text-ink-muted">Sin secciones todavía.</p>
        </div>
      )}

      <ul className="space-y-5">
        {sections.map((section) => (
          <li key={section.id} className="rounded-xl border border-line bg-surface">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-3.5">
              <div className="flex flex-wrap items-center gap-2.5">
                {section.order != null && (
                  <span className="font-mono text-sm text-ink-muted">{section.order}.</span>
                )}
                <h2 className="font-semibold tracking-tight">{section.name}</h2>
                <span className="text-sm text-ink-muted">{section.durationMinutes} min</span>
                {section.skillsMeasured.map((s) => (
                  <Badge key={s}>{SKILL_LABEL[s]}</Badge>
                ))}
              </div>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setTypeModal({ sectionId: section.id, sectionName: section.name })
                  }
                >
                  + Tipo de pregunta
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setSectionModal({ editing: section })}>
                  Editar
                </Button>
                <Button variant="danger" size="sm" onClick={() => handleDeleteSection(section)}>
                  Eliminar
                </Button>
              </div>
            </div>

            {section.questionTypes.length === 0 ? (
              <p className="px-5 py-4 text-sm text-ink-muted">Sin tipos de pregunta.</p>
            ) : (
              <ul className="divide-y divide-line">
                {section.questionTypes.map((qt) => (
                  <li key={qt.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium">{qt.name}</span>
                      <Badge tone="brand">{qt.inputMedia}</Badge>
                      <Badge tone="brand">{qt.responseType}</Badge>
                      <Badge>
                        {qt.timingMode === "PER_QUESTION"
                          ? `${qt.timePerItemSeconds}s por ítem`
                          : "tiempo por sección"}
                      </Badge>
                      {qt.prepTimeSeconds && <Badge>prep {qt.prepTimeSeconds}s</Badge>}
                      {qt.replaysAllowed && <Badge>{qt.replaysAllowed} reproducciones</Badge>}
                      {!qt.isScored && <Badge tone="warning">revisión en vivo</Badge>}
                      <span className="text-xs text-ink-muted">
                        {qt.questionCount} pregunta{qt.questionCount === 1 ? "" : "s"}
                      </span>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setTypeModal({
                            sectionId: section.id,
                            sectionName: section.name,
                            editing: qt,
                          })
                        }
                      >
                        Editar
                      </Button>
                      <Button variant="danger" size="sm" onClick={() => handleDeleteType(qt)}>
                        Eliminar
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>

      {sectionModal && (
        <SectionForm
          slug={slug}
          examTypeId={examTypeId}
          sectionOrderMode={sectionOrderMode}
          editing={sectionModal.editing}
          onClose={() => setSectionModal(null)}
        />
      )}

      {typeModal && (
        <QuestionTypeForm
          slug={slug}
          sectionId={typeModal.sectionId}
          sectionName={typeModal.sectionName}
          subscoreDefinitions={subscoreDefinitions}
          editing={typeModal.editing}
          onClose={() => setTypeModal(null)}
        />
      )}
    </div>
  );
}

/* ───────────── Formulario de sección ───────────── */

function SectionForm({
  slug,
  examTypeId,
  sectionOrderMode,
  editing,
  onClose,
}: {
  slug: string;
  examTypeId: string;
  sectionOrderMode: "FIXED" | "MIXED";
  editing?: SectionRow;
  onClose: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState(editing?.name ?? "");
  const [order, setOrder] = useState(editing?.order?.toString() ?? "");
  const [duration, setDuration] = useState(editing?.durationMinutes.toString() ?? "30");
  const [skills, setSkills] = useState<string[]>(editing?.skillsMeasured ?? []);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    const input = {
      examTypeId,
      slug,
      name,
      order: sectionOrderMode === "FIXED" && order ? Number(order) : null,
      durationMinutes: Number(duration),
      skillsMeasured: skills as ("READING" | "WRITING" | "LISTENING" | "SPEAKING")[],
    };
    const result = editing ? await updateSection(editing.id, input) : await createSection(input);
    if (!result.ok) {
      setError(result.error);
      setSaving(false);
      return;
    }
    router.refresh();
    onClose();
  }

  return (
    <Modal open onClose={onClose} title={editing ? "Editar sección" : "Nueva sección"}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Nombre">
          <Input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Reading" />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          {sectionOrderMode === "FIXED" && (
            <Field label="Orden" help="Posición dentro del examen.">
              <Input type="number" min={1} value={order} onChange={(e) => setOrder(e.target.value)} />
            </Field>
          )}
          <Field label="Duración (min)">
            <Input type="number" min={1} value={duration} onChange={(e) => setDuration(e.target.value)} required />
          </Field>
        </div>
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium">Habilidades que mide</legend>
          <div className="flex flex-wrap gap-4">
            {SKILLS.map((s) => (
              <Checkbox
                key={s}
                label={SKILL_LABEL[s]}
                checked={skills.includes(s)}
                onChange={(e) =>
                  setSkills(
                    e.target.checked ? [...skills, s] : skills.filter((x) => x !== s),
                  )
                }
              />
            ))}
          </div>
        </fieldset>
        <ErrorNote>{error}</ErrorNote>
        <div className="flex gap-3 pt-1">
          <Button type="submit" disabled={saving || !name || skills.length === 0}>
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

/* ───────────── Formulario de tipo de pregunta ───────────── */

const INPUT_MEDIA = ["TEXT", "AUDIO", "IMAGE", "VIDEO", "CONVERSATION"] as const;
const RESPONSE_TYPES = [
  "MULTIPLE_CHOICE",
  "DRAG_SELECT",
  "FILL_BLANK",
  "TYPE_TEXT",
  "AUDIO_RECORDING",
  "FREE_TEXT",
] as const;

function QuestionTypeForm({
  slug,
  sectionId,
  sectionName,
  subscoreDefinitions,
  editing,
  onClose,
}: {
  slug: string;
  sectionId: string;
  sectionName: string;
  subscoreDefinitions: string[];
  editing?: QuestionTypeRow;
  onClose: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState(editing?.name ?? "");
  const [inputMedia, setInputMedia] = useState(editing?.inputMedia ?? "TEXT");
  const [responseType, setResponseType] = useState(editing?.responseType ?? "MULTIPLE_CHOICE");
  const [timingMode, setTimingMode] = useState(editing?.timingMode ?? "PER_QUESTION");
  const [timePerItem, setTimePerItem] = useState(editing?.timePerItemSeconds?.toString() ?? "60");
  const [prepTime, setPrepTime] = useState(editing?.prepTimeSeconds?.toString() ?? "");
  const [replays, setReplays] = useState(editing?.replaysAllowed?.toString() ?? "");
  const [isScored, setIsScored] = useState(editing?.isScored ?? true);
  const [mapping, setMapping] = useState<string[]>(editing?.subscoreMapping ?? []);
  const [schema, setSchema] = useState(
    editing?.adminFieldSchema ?? JSON.stringify(ADMIN_FIELD_SCHEMA_TEMPLATE, null, 2),
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    try {
      adminFieldSchemaZ.parse(JSON.parse(schema));
    } catch (err) {
      setError(
        err instanceof SyntaxError
          ? "El esquema de campos no es JSON válido."
          : "El esquema de campos no cumple el contrato (revisa keys, types y targets).",
      );
      return;
    }

    setSaving(true);
    const input = {
      sectionId,
      slug,
      name,
      inputMedia: inputMedia as (typeof INPUT_MEDIA)[number],
      responseType: responseType as (typeof RESPONSE_TYPES)[number],
      timingMode: timingMode as "PER_QUESTION" | "PER_SECTION",
      timePerItemSeconds: timingMode === "PER_QUESTION" && timePerItem ? Number(timePerItem) : null,
      prepTimeSeconds: prepTime ? Number(prepTime) : null,
      replaysAllowed: replays ? Number(replays) : null,
      isScored,
      subscoreMapping: mapping,
      adminFieldSchema: schema,
    };
    const result = editing
      ? await updateQuestionType(editing.id, input)
      : await createQuestionType(input);
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
          ? `Editar tipo de pregunta — ${sectionName}`
          : `Nuevo tipo de pregunta — ${sectionName}`
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Nombre">
          <Input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Listen and Type" />
        </Field>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Field label="Medio de entrada">
            <Select value={inputMedia} onChange={(e) => setInputMedia(e.target.value)}>
              {INPUT_MEDIA.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </Select>
          </Field>
          <Field label="Tipo de respuesta">
            <Select value={responseType} onChange={(e) => setResponseType(e.target.value)}>
              {RESPONSE_TYPES.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </Select>
          </Field>
          <Field label="Modo de tiempo">
            <Select value={timingMode} onChange={(e) => setTimingMode(e.target.value)}>
              <option value="PER_QUESTION">Por pregunta</option>
              <option value="PER_SECTION">Por sección</option>
            </Select>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {timingMode === "PER_QUESTION" && (
            <Field label="Segundos por ítem">
              <Input type="number" min={1} value={timePerItem} onChange={(e) => setTimePerItem(e.target.value)} required />
            </Field>
          )}
          <Field label="Preparación (s)" help="Vacío si no aplica.">
            <Input type="number" min={1} value={prepTime} onChange={(e) => setPrepTime(e.target.value)} />
          </Field>
          <Field label="Reproducciones" help="Vacío si no aplica.">
            <Input type="number" min={1} value={replays} onChange={(e) => setReplays(e.target.value)} />
          </Field>
        </div>

        <Checkbox
          label="El sistema califica este tipo (desmarcar = se revisa en sesión en vivo)"
          checked={isScored}
          onChange={(e) => setIsScored(e.target.checked)}
        />

        <fieldset>
          <legend className="mb-1.5 text-sm font-medium">Alimenta a estos subscores</legend>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {subscoreDefinitions.map((s) => (
              <Checkbox
                key={s}
                label={s}
                checked={mapping.includes(s)}
                onChange={(e) =>
                  setMapping(e.target.checked ? [...mapping, s] : mapping.filter((x) => x !== s))
                }
              />
            ))}
          </div>
        </fieldset>

        <Field
          label="Esquema de campos del formulario de captura (JSON)"
          help='Define qué campos verá el admin al capturar preguntas de este tipo. Tipos: text, textarea, number, toggle, audio, image, video, options, list, repeater. Cada campo declara target: "prompt" o "answer".'
        >
          <Textarea
            value={schema}
            onChange={(e) => setSchema(e.target.value)}
            rows={14}
            required
            spellCheck={false}
            className="font-mono text-xs"
          />
        </Field>

        <ErrorNote>{error}</ErrorNote>

        <div className="flex gap-3 pt-1">
          <Button type="submit" disabled={saving || !name}>
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
