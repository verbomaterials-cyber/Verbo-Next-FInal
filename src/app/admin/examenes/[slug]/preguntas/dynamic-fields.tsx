"use client";

/*
 * Renderer del formulario dinámico de captura de preguntas.
 * Se genera 100% desde el adminFieldSchema del QuestionType:
 * ningún tipo de pregunta tiene formulario codificado a mano.
 *
 * Modelo de valores:
 *  - target "prompt" → promptContent[key] · target "answer" → correctAnswer[key]
 *  - "options" con withCorrect: opciones en prompt[key], índices correctos
 *    en answer[key] (number si single, number[] si multiple)
 *  - "repeater": prompt[key] = array de objetos; los valores de sus
 *    itemFields viven DENTRO de cada objeto (incluidas las respuestas de
 *    options anidadas, como { options: [...], correct: ... })
 */

import type { AdminField } from "@/lib/exam-config";
import { Button, Checkbox, Field, Input, Textarea, cn } from "@/components/ui";

export type QuestionValues = {
  prompt: Record<string, unknown>;
  answer: Record<string, unknown>;
};

const MEDIA_PLACEHOLDER: Record<string, string> = {
  audio: "https://…/audio.mp3",
  image: "https://…/imagen.jpg",
  video: "https://…/video.mp4",
};

export function DynamicFields({
  fields,
  values,
  onChange,
}: {
  fields: AdminField[];
  values: QuestionValues;
  onChange: (next: QuestionValues) => void;
}) {
  function setValue(field: AdminField, value: unknown) {
    const bucket = field.target === "prompt" ? "prompt" : "answer";
    onChange({ ...values, [bucket]: { ...values[bucket], [field.key]: value } });
  }

  function getValue(field: AdminField): unknown {
    return field.target === "prompt" ? values.prompt[field.key] : values.answer[field.key];
  }

  return (
    <div className="space-y-4">
      {fields.map((field) => (
        <FieldRenderer
          key={field.key}
          field={field}
          value={getValue(field)}
          answerValue={values.answer[field.key]}
          onChange={(v) => setValue(field, v)}
          onAnswerChange={(v) =>
            onChange({ ...values, answer: { ...values.answer, [field.key]: v } })
          }
        />
      ))}
    </div>
  );
}

function FieldRenderer({
  field,
  value,
  answerValue,
  onChange,
  onAnswerChange,
}: {
  field: AdminField;
  value: unknown;
  /** solo para options withCorrect a nivel raíz */
  answerValue?: unknown;
  onChange: (v: unknown) => void;
  onAnswerChange?: (v: unknown) => void;
}) {
  const label = field.required ? `${field.label} *` : field.label;

  switch (field.type) {
    case "text":
      return (
        <Field label={label} help={field.help}>
          <Input value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} />
        </Field>
      );
    case "textarea":
      return (
        <Field label={label} help={field.help}>
          <Textarea rows={4} value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} />
        </Field>
      );
    case "number":
      return (
        <Field label={label} help={field.help}>
          <Input
            type="number"
            value={value == null ? "" : String(value)}
            onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
          />
        </Field>
      );
    case "toggle":
      return (
        <Checkbox
          label={label}
          checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
        />
      );
    case "audio":
    case "image":
    case "video":
      return (
        <Field
          label={label}
          help={field.help ?? "URL del recurso (la subida de archivos se conecta después)."}
        >
          <Input
            type="url"
            placeholder={MEDIA_PLACEHOLDER[field.type]}
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value)}
          />
        </Field>
      );
    case "list":
      return (
        <ListEditor
          label={label}
          help={field.help}
          items={(value as string[]) ?? []}
          onChange={onChange}
        />
      );
    case "options":
      return (
        <OptionsEditor
          label={label}
          help={field.help}
          multiple={field.multiple ?? false}
          withCorrect={field.withCorrect ?? false}
          options={(value as string[]) ?? []}
          correct={answerValue}
          onOptionsChange={onChange}
          onCorrectChange={onAnswerChange ?? (() => {})}
        />
      );
    case "repeater":
      return (
        <RepeaterEditor
          label={label}
          help={field.help}
          itemFields={field.itemFields ?? []}
          items={(value as Record<string, unknown>[]) ?? []}
          onChange={onChange}
        />
      );
  }
}

/* ───────────── list: lista de strings ───────────── */

function ListEditor({
  label,
  help,
  items,
  onChange,
}: {
  label: string;
  help?: string;
  items: string[];
  onChange: (v: string[]) => void;
}) {
  return (
    <div>
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={i} className="flex gap-2">
            <Input
              value={item}
              onChange={(e) => onChange(items.map((x, j) => (j === i ? e.target.value : x)))}
            />
            <Button
              type="button"
              variant="danger"
              size="sm"
              aria-label={`Quitar elemento ${i + 1}`}
              onClick={() => onChange(items.filter((_, j) => j !== i))}
            >
              ✕
            </Button>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={() => onChange([...items, ""])}>
          + Agregar
        </Button>
      </div>
      {help && <span className="mt-1 block text-xs text-ink-muted">{help}</span>}
    </div>
  );
}

/* ───────────── options: opciones con marcado de correctas ───────────── */

function OptionsEditor({
  label,
  help,
  multiple,
  withCorrect,
  options,
  correct,
  onOptionsChange,
  onCorrectChange,
}: {
  label: string;
  help?: string;
  multiple: boolean;
  withCorrect: boolean;
  options: string[];
  correct: unknown;
  onOptionsChange: (v: string[]) => void;
  onCorrectChange: (v: unknown) => void;
}) {
  const correctSet = new Set<number>(
    Array.isArray(correct) ? (correct as number[]) : typeof correct === "number" ? [correct] : [],
  );

  function toggleCorrect(index: number) {
    if (multiple) {
      const next = new Set(correctSet);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      onCorrectChange([...next].sort((a, b) => a - b));
    } else {
      onCorrectChange(index);
    }
  }

  function removeOption(index: number) {
    onOptionsChange(options.filter((_, j) => j !== index));
    if (multiple) {
      onCorrectChange(
        [...correctSet].filter((c) => c !== index).map((c) => (c > index ? c - 1 : c)),
      );
    } else if (correctSet.has(index)) {
      onCorrectChange(undefined);
    }
  }

  return (
    <div>
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      <div className="space-y-2">
        {options.map((opt, i) => (
          <div key={i} className="flex items-center gap-2">
            {withCorrect && (
              <input
                type={multiple ? "checkbox" : "radio"}
                checked={correctSet.has(i)}
                onChange={() => toggleCorrect(i)}
                aria-label={`Opción ${i + 1} correcta`}
                className="size-4 shrink-0 accent-(--brand)"
              />
            )}
            <Input
              value={opt}
              onChange={(e) => onOptionsChange(options.map((x, j) => (j === i ? e.target.value : x)))}
              className={cn(withCorrect && correctSet.has(i) && "border-success")}
            />
            <Button
              type="button"
              variant="danger"
              size="sm"
              aria-label={`Quitar opción ${i + 1}`}
              onClick={() => removeOption(i)}
            >
              ✕
            </Button>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={() => onOptionsChange([...options, ""])}>
          + Opción
        </Button>
      </div>
      <span className="mt-1 block text-xs text-ink-muted">
        {help ??
          (withCorrect
            ? multiple
              ? "Marca todas las opciones correctas."
              : "Marca la opción correcta."
            : undefined)}
      </span>
    </div>
  );
}

/* ───────────── repeater: sub-objetos anidados ───────────── */

function RepeaterEditor({
  label,
  help,
  itemFields,
  items,
  onChange,
}: {
  label: string;
  help?: string;
  itemFields: AdminField[];
  items: Record<string, unknown>[];
  onChange: (v: Record<string, unknown>[]) => void;
}) {
  function updateItem(index: number, key: string, value: unknown) {
    onChange(items.map((item, i) => (i === index ? { ...item, [key]: value } : item)));
  }

  return (
    <div>
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      {help && <span className="mb-2 block text-xs text-ink-muted">{help}</span>}
      <div className="space-y-3">
        {items.map((item, i) => (
          <div key={i} className="rounded-lg border border-line bg-background p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-medium text-ink-muted">#{i + 1}</span>
              <Button
                type="button"
                variant="danger"
                size="sm"
                onClick={() => onChange(items.filter((_, j) => j !== i))}
              >
                Quitar
              </Button>
            </div>
            <div className="space-y-3">
              {itemFields.map((f) => {
                // dentro del repeater, options+withCorrect guarda {options, correct} en el item
                if (f.type === "options" && f.withCorrect) {
                  const stored = (item[f.key] as { options?: string[]; correct?: unknown }) ?? {};
                  return (
                    <OptionsEditor
                      key={f.key}
                      label={f.required ? `${f.label} *` : f.label}
                      help={f.help}
                      multiple={f.multiple ?? false}
                      withCorrect
                      options={stored.options ?? []}
                      correct={stored.correct}
                      onOptionsChange={(opts) =>
                        updateItem(i, f.key, { ...stored, options: opts })
                      }
                      onCorrectChange={(c) => updateItem(i, f.key, { ...stored, correct: c })}
                    />
                  );
                }
                return (
                  <FieldRenderer
                    key={f.key}
                    field={f}
                    value={item[f.key]}
                    onChange={(v) => updateItem(i, f.key, v)}
                  />
                );
              })}
            </div>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={() => onChange([...items, {}])}>
          + Agregar elemento
        </Button>
      </div>
    </div>
  );
}
