"use client";

/*
 * Renderiza el contenido público y las interacciones de respuesta. Reutiliza
 * el esquema administrativo cuando corresponde y admite tareas específicas.
 */

import { Fragment, type ReactNode } from "react";
import type { AdminField, AdminFieldSchema } from "@/lib/exam-config";
import { AudioPlayer } from "./audio-player";
import { AudioRecorder, type RecordingResult } from "./audio-recorder";
import { SentenceBuilder } from "./sentence-builder";
import { validSentenceOrder } from "@/lib/sentence-answer";

export type EngineQuestionType = {
  id: string;
  name: string;
  inputMedia: string;
  responseType: string;
  timingMode: "PER_QUESTION" | "PER_SECTION";
  timePerItemSeconds: number | null;
  prepTimeSeconds: number | null;
  replaysAllowed: number | null;
  isScored: boolean;
  sectionId: string;
  adminFieldSchema: AdminFieldSchema;
  timingGroupKey?: string;
};

export type EngineQuestion = {
  id: string;
  order: number;
  promptContent: Record<string, unknown>;
  questionType: EngineQuestionType;
  module?: { id: string; number: 1 | 2 };
  itemCount?: number;
};

export type AnswerValue = Record<string, unknown>;

/* ¿La respuesta actual permite avanzar? */
export function isAnswerValid(question: EngineQuestion, value: AnswerValue): boolean {
  const { responseType, adminFieldSchema } = question.questionType;
  const prompt = question.promptContent;

  if (responseType === "DRAG_SELECT" && Array.isArray(prompt.wordBank)) {
    return validSentenceOrder(value.order, prompt.wordBank, prompt.slots);
  }

  switch (responseType) {
    case "MULTIPLE_CHOICE":
    case "DRAG_SELECT": {
      const optionsField = adminFieldSchema.fields.find(
        (f) => f.type === "options" && f.target === "prompt",
      );
      if (optionsField) {
        const v = value[optionsField.key];
        return optionsField.multiple ? Array.isArray(v) && v.length > 0 : typeof v === "number";
      }
      const repeater = findRepeaterWithOptions(adminFieldSchema);
      if (repeater) {
        const items = (prompt[repeater.key] as Record<string, unknown>[]) ?? [];
        const chosen = (value[repeater.key] as (number | null)[]) ?? [];
        return items.length > 0 && items.every((_, i) => typeof chosen[i] === "number");
      }
      return false;
    }
    case "FILL_BLANK": {
      const blanks = getBlanks(prompt, adminFieldSchema);
      const answers = (value.answers as string[]) ?? [];
      return blanks.length > 0 && blanks.every((_, i) => (answers[i] ?? "").trim().length > 0);
    }
    case "TYPE_TEXT":
      return typeof value.text === "string" && value.text.trim().length > 0;
    case "FREE_TEXT": {
      const text = typeof value.text === "string" ? value.text.trim() : "";
      return text.length > 0;
    }
    case "AUDIO_RECORDING": {
      const v = value as Partial<RecordingResult>;
      return v.recorded === true || v.error !== undefined;
    }
    default:
      return true;
  }
}

export function countWords(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

function findRepeaterWithOptions(schema: AdminFieldSchema): AdminField | undefined {
  return schema.fields.find(
    (f) => f.type === "repeater" && f.itemFields?.some((x) => x.type === "options"),
  );
}

/* Segmentos de un texto con huecos: "The w[eather] was" → texto + blanks */
type BlankSegment = { type: "text"; content: string } | { type: "blank"; length: number; prefix: string };

function parseBlanks(text: string): BlankSegment[] {
  const segments: BlankSegment[] = [];
  const regex = /\[([^\]]+)\]/g;
  let last = 0;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const preceding = text.slice(last, match.index);
    const prefix = preceding.match(/[A-Za-z]+$/)?.[0] ?? "";
    if (preceding.length > prefix.length) segments.push({ type: "text", content: preceding.slice(0, preceding.length - prefix.length) });
    segments.push({ type: "blank", length: match[1].length, prefix });
    last = regex.lastIndex;
  }
  if (last < text.length) segments.push({ type: "text", content: text.slice(last) });
  return segments;
}

function getBlanks(prompt: Record<string, unknown>, schema: AdminFieldSchema): number[] {
  const field = schema.fields.find(
    (f) => f.target === "prompt" && (f.type === "textarea" || f.type === "text"),
  );
  const text = field ? String(prompt[field.key] ?? "") : "";
  return parseBlanks(text)
    .filter((s) => s.type === "blank")
    .map((s) => (s as { length: number }).length);
}

/* ───────────────────── Render ───────────────────── */

export function QuestionRenderer({
  question,
  value,
  onChange,
  split,
  serifTitles = false,
  attemptId,
  availableSeconds,
  onMediaBusyChange,
  spokenPhase,
  onStimulusEnded,
  language = "es",
  previewMode = false,
  audioConsumed = false,
  autoPlayAudio = false,
  onAudioStarted,
  allowSpeakingRecovery = false,
}: {
  question: EngineQuestion;
  value: AnswerValue;
  onChange: (v: AnswerValue) => void;
  /** true = pasaje a la izquierda, interacción a la derecha (TOEFL Reading) */
  split: boolean;
  /** el examen usa títulos serif (etiquetas editoriales) */
  serifTitles?: boolean;
  attemptId: string;
  availableSeconds: number;
  onMediaBusyChange: (busy: boolean) => void;
  spokenPhase?: "stimulus" | "answer";
  onStimulusEnded?: () => void;
  language?: "en" | "es";
  previewMode?: boolean;
  audioConsumed?: boolean;
  autoPlayAudio?: boolean;
  onAudioStarted?: () => Promise<void>;
  allowSpeakingRecovery?: boolean;
}) {
  const { adminFieldSchema, responseType, replaysAllowed } = question.questionType;
  const prompt = question.promptContent;
  const promptFields = adminFieldSchema.fields.filter((f) => f.target === "prompt");

  // Campo de pasaje para layout dividido: primer textarea largo
  const passageField = split && responseType !== "FILL_BLANK" && responseType !== "DRAG_SELECT"
    ? promptFields.find(
        (f) => ["passage", "professorPost", "scenario"].includes(f.key) && typeof prompt[f.key] === "string",
      )
    : undefined;

  const interactive = renderInteraction();
  const displayFields = promptFields.filter(
    (f) => f !== passageField && !(passageField && f.key === "title") && !consumedByInteraction(f),
  );

  function consumedByInteraction(field: AdminField): boolean {
    if (responseType === "DRAG_SELECT" && Array.isArray(prompt.wordBank) && ["wordBank", "slots"].includes(field.key)) return true;
    if (responseType === "MULTIPLE_CHOICE" || responseType === "DRAG_SELECT") {
      if (field.type === "options") return true;
      if (field.type === "repeater" && field.itemFields?.some((x) => x.type === "options"))
        return true;
    }
    if (responseType === "FILL_BLANK" && (field.type === "textarea" || field.type === "text"))
      return true;
    if (field.key === "minWords") return true;
    return false;
  }

  function renderInteraction(): ReactNode {
    if (responseType === "DRAG_SELECT" && Array.isArray(prompt.wordBank)) {
      return <SentenceBuilder words={prompt.wordBank as string[]}
        slots={typeof prompt.slots === "number" ? prompt.slots : prompt.wordBank.length}
        value={Array.isArray(value.order) ? value.order as number[] : []}
        onChange={(order) => onChange({ ...value, order })} />;
    }
    switch (responseType) {
      case "MULTIPLE_CHOICE":
      case "DRAG_SELECT": {
        const optionsField = adminFieldSchema.fields.find(
          (f) => f.type === "options" && f.target === "prompt",
        );
        if (optionsField) {
          const options = (prompt[optionsField.key] as string[]) ?? [];
          const multiple = optionsField.multiple ?? false;
          return (
            <ChoiceGroup
              options={options}
              multiple={multiple}
              value={value[optionsField.key]}
              onChange={(v) => onChange({ ...value, [optionsField.key]: v })}
            />
          );
        }
        const repeater = findRepeaterWithOptions(adminFieldSchema);
        if (repeater) return renderSubQuestions(repeater);
        return null;
      }

      case "FILL_BLANK": {
        const textField = promptFields.find(
          (f) => f.type === "textarea" || f.type === "text",
        );
        const text = textField ? String(prompt[textField.key] ?? "") : "";
        const segments = parseBlanks(text);
        const answers = (value.answers as string[]) ?? [];
        let blankIndex = -1;
        return (
          <p className="text-lg leading-loose" style={{ color: "var(--xink)" }}>
            {segments.map((seg, i) => {
              if (seg.type === "text") return <Fragment key={i}>{seg.content}</Fragment>;
              blankIndex += 1;
              const bi = blankIndex;
              return (
                <span key={i} className="inline-flex items-baseline whitespace-nowrap">{seg.prefix}<input
                  type="text"
                  autoComplete="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  value={answers[bi] ?? ""}
                  maxLength={seg.length}
                  aria-label={language === "en" ? `Blank ${bi + 1}` : `Hueco ${bi + 1}`}
                  onChange={(e) => {
                    const next = [...answers];
                    next[bi] = e.target.value;
                    onChange({ ...value, answers: next });
                  }}
                  className="mx-0.5 inline-block rounded-md border-b-2 bg-transparent px-1.5 py-0.5 text-center font-semibold outline-none transition-colors focus:border-(--xaccent2)"
                  style={{
                    width: `${Math.max(seg.length * 0.68 + 0.4, 1.6)}em`,
                    borderColor: "var(--xline)",
                    color: "var(--xaccent2)",
                    fontFamily: "var(--xfont-display)",
                  }}
                /></span>
              );
            })}
          </p>
        );
      }

      case "TYPE_TEXT":
        return (
          <input
            type="text"
            value={(value.text as string) ?? ""}
            onChange={(e) => onChange({ ...value, text: e.target.value })}
            placeholder={language === "en" ? "Type what you heard…" : "Escribe lo que escuchaste…"}
            aria-label={language === "en" ? "Your response" : "Tu respuesta"}
            className="w-full border px-4 py-3 text-lg outline-none transition-colors focus:border-(--xaccent2)"
            style={{
              borderRadius: "min(var(--xcontrol), 16px)",
              borderColor: "var(--xline)",
              backgroundColor: "var(--xsurface)",
              color: "var(--xink)",
            }}
          />
        );

      case "FREE_TEXT": {
        const text = (value.text as string) ?? "";
        const minWords = typeof prompt.minWords === "number" ? prompt.minWords : null;
        const words = countWords(text);
        return (
          <div>
            <textarea
              value={text}
              onChange={(e) => onChange({ ...value, text: e.target.value })}
              rows={9}
              spellCheck={false}
              aria-label={language === "en" ? "Your response" : "Tu respuesta"}
              className="w-full resize-y border px-4 py-3 text-base leading-relaxed outline-none transition-colors focus:border-(--xaccent2)"
              style={{
                borderRadius: "min(var(--xcontrol), 16px)",
                borderColor: "var(--xline)",
                backgroundColor: "var(--xsurface)",
                color: "var(--xink)",
              }}
            />
            <p className="mt-1.5 text-sm tabular-nums" style={{ color: "var(--xmuted)" }}>
              <span style={{ fontFamily: "var(--xfont-display)", color: "var(--xink)" }}>{words}</span> {language === "en" ? (words === 1 ? "word" : "words") : (words === 1 ? "palabra" : "palabras")}
              {minWords ? language === "en" ? ` · suggested length: ${minWords}+ words` : ` · referencia: ${minWords}+ palabras` : ""}
            </p>
          </div>
        );
      }

      case "AUDIO_RECORDING":
        if (previewMode) return <div className="rounded-lg border border-dashed p-7 text-center text-sm" style={{ borderColor: "var(--xline)", color: "var(--xmuted)" }}>
          <p className="mb-2 text-lg font-semibold" style={{ color: "var(--xink)" }}>Record your response</p>
          <p>Response time: {question.questionType.timePerItemSeconds} seconds.</p>
          <p className="mt-2">The microphone is available when taking an assigned test.</p>
        </div>;
        if (spokenPhase === "stimulus") return <div className="py-6 text-center text-sm" style={{ color: "var(--xmuted)" }}>
          <p role="status">{allowSpeakingRecovery ? "This prompt has already been played. Continue to record your response." : "Listen to the prompt. Recording starts after the audio finishes."}</p>
          {allowSpeakingRecovery && <button type="button" onClick={onStimulusEnded} className="mt-4 rounded-md border px-4 py-2">Start response</button>}
        </div>;
        return (
          <AudioRecorder
            language={language}
            autoStart={spokenPhase === "answer"}
            attemptId={attemptId}
            questionId={question.id}
            availableSeconds={availableSeconds}
            onBusyChange={onMediaBusyChange}
            initialValue={value}
            maxSeconds={question.questionType.timePerItemSeconds ?? 90}
            prepSeconds={question.questionType.prepTimeSeconds}
            onComplete={(result) => onChange({ ...result })}
          />
        );

      default:
        return null;
    }
  }

  function renderSubQuestions(repeater: AdminField): ReactNode {
    const items = (prompt[repeater.key] as Record<string, unknown>[]) ?? [];
    const chosen = (value[repeater.key] as (number | null)[]) ?? [];
    const optionsField = repeater.itemFields!.find((f) => f.type === "options")!;
    const otherFields = repeater.itemFields!.filter((f) => f !== optionsField);

    return (
      <ol className="space-y-8">
        {items.map((item, i) => {
          const stored = item[optionsField.key] as { options?: string[] } | undefined;
          const options = stored?.options ?? [];
          return (
            <li key={i}>
              <div className="mb-3 space-y-3">
                {otherFields.map((f) => (
                  <PromptFieldDisplay
                    key={f.key}
                    field={f}
                    value={item[f.key]}
                    replaysAllowed={replaysAllowed}
                    language={language}
                    compact
                  />
                ))}
              </div>
              <ChoiceGroup
                options={options}
                multiple={false}
                value={chosen[i] ?? undefined}
                onChange={(v) => {
                  const next = [...chosen];
                  next[i] = v as number;
                  onChange({ ...value, [repeater.key]: next });
                }}
              />
            </li>
          );
        })}
      </ol>
    );
  }

  const promptBlock = (
    <div className="space-y-5">
      {displayFields.map((f) => (
        <PromptFieldDisplay
          key={f.key}
          field={f}
          value={prompt[f.key]}
          replaysAllowed={replaysAllowed}
          language={language}
          onAudioComplete={responseType === "AUDIO_RECORDING" ? onStimulusEnded : undefined}
          audioDisabled={spokenPhase === "answer" && responseType === "AUDIO_RECORDING"}
          audioConsumed={audioConsumed}
          autoPlayAudio={autoPlayAudio && !previewMode}
          onAudioStarted={onAudioStarted}
          onAudioBusyChange={onMediaBusyChange}
        />
      ))}
    </div>
  );

  if (passageField) {
    return (
      <div className="grid gap-8 lg:grid-cols-[55fr_45fr]">
        <div className="lg:border-r lg:pr-8" style={{ borderColor: "var(--xline)" }}>
          {typeof prompt.title === "string" && <h2 className="mb-4 text-lg font-semibold" style={{ color: "var(--xink)" }}>{prompt.title}</h2>}
          {serifTitles && (
            <p
              className="mb-3 text-sm"
              style={{ fontFamily: "var(--xfont-display)", fontStyle: "italic", color: "var(--xmuted)" }}
            >
              Lectura
            </p>
          )}
          <div
            className="max-h-[58dvh] overflow-y-auto pr-1 text-[1.02rem] leading-[1.75] whitespace-pre-wrap"
            style={{ color: "var(--xink)" }}
          >
            {String(prompt[passageField.key] ?? "")}
          </div>
        </div>
        <div className="space-y-5">
          {promptBlock}
          {interactive}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {promptBlock}
      {interactive}
    </div>
  );
}

/* Muestra un campo del prompt según su tipo declarado */
function PromptFieldDisplay({
  field,
  value,
  replaysAllowed,
  compact,
  onAudioComplete,
  audioDisabled,
  language = "es",
  audioConsumed,
  autoPlayAudio,
  onAudioStarted,
  onAudioBusyChange,
}: {
  field: AdminField;
  value: unknown;
  replaysAllowed: number | null;
  compact?: boolean;
  onAudioComplete?: () => void;
  audioDisabled?: boolean;
  language?: "en" | "es";
  audioConsumed?: boolean;
  autoPlayAudio?: boolean;
  onAudioStarted?: () => Promise<void>;
  onAudioBusyChange?: (busy: boolean) => void;
}) {
  if (field.studentHidden) return null;
  if (value === undefined || value === null || value === "") return null;

  switch (field.type) {
    case "text":
    case "textarea":
      return (
        <p
          className={
            compact ? "text-base leading-relaxed" : "text-lg leading-relaxed whitespace-pre-wrap"
          }
          style={{ color: "var(--xink)" }}
        >
          {String(value)}
        </p>
      );
    case "image":
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={String(value)}
          alt={language === "en" ? "Question image" : "Imagen de la pregunta"}
          className="mx-auto max-h-[42dvh] rounded-xl object-contain"
        />
      );
    case "audio":
      return <AudioPlayer src={String(value)} maxReplays={audioDisabled ? 0 : replaysAllowed} onComplete={onAudioComplete} language={language}
        consumed={audioConsumed} autoPlay={autoPlayAudio} onStarted={onAudioStarted} onBusyChange={onAudioBusyChange} />;
    case "video":
      return (
        <video src={String(value)} controls className="mx-auto max-h-[42dvh] rounded-xl" />
      );
    case "list": {
      const items = (value as string[]) ?? [];
      return (
        <ul
          className="list-disc space-y-1 pl-5 text-base leading-relaxed"
          style={{ color: "var(--xink)" }}
        >
          {items.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      );
    }
    case "repeater": {
      // repeater sin opciones (ej. respuestas de estudiantes en Academic Discussion)
      const items = (value as Record<string, unknown>[]) ?? [];
      return (
        <div className="space-y-3">
          {items.map((item, i) => (
            <div
              key={i}
              className="rounded-lg border p-4"
              style={{ borderColor: "var(--xline)", backgroundColor: "var(--xsurface)" }}
            >
              {field.itemFields?.map((f) => {
                const v = item[f.key];
                if (v === undefined || v === null || v === "") return null;
                return f.key === "author" || f.type === "text" ? (
                  <p key={f.key} className="text-sm font-semibold" style={{ color: "var(--xink)" }}>
                    {String(v)}
                  </p>
                ) : (
                  <p
                    key={f.key}
                    className="mt-1 text-base leading-relaxed"
                    style={{ color: "var(--xink)" }}
                  >
                    {String(v)}
                  </p>
                );
              })}
            </div>
          ))}
        </div>
      );
    }
    default:
      return null;
  }
}

/* Grupo de opciones (única o múltiple) */
function ChoiceGroup({
  options,
  multiple,
  value,
  onChange,
}: {
  options: string[];
  multiple: boolean;
  value: unknown;
  onChange: (v: number | number[]) => void;
}) {
  const selected = new Set<number>(
    Array.isArray(value) ? (value as number[]) : typeof value === "number" ? [value] : [],
  );

  function toggle(i: number) {
    if (multiple) {
      const next = new Set(selected);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      onChange([...next].sort((a, b) => a - b));
    } else {
      onChange(i);
    }
  }

  return (
    <div role={multiple ? "group" : "radiogroup"} className="space-y-2.5">
      {options.map((opt, i) => {
        const active = selected.has(i);
        return (
          <button
            key={i}
            type="button"
            role={multiple ? "checkbox" : "radio"}
            aria-checked={active}
            onClick={() => toggle(i)}
            className="flex w-full items-center gap-3 border px-4 py-3.5 text-left text-base transition-colors duration-150"
            style={{
              borderRadius: "min(var(--xcontrol), 24px)",
              borderWidth: active ? 1.5 : 1,
              borderColor: active ? "var(--xaccent2)" : "var(--xline)",
              backgroundColor: active
                ? "color-mix(in oklab, var(--xaccent) 12%, var(--xsurface))"
                : "var(--xsurface)",
              color: "var(--xink)",
            }}
          >
            <span
              aria-hidden
              className="flex size-5 shrink-0 items-center justify-center border text-[11px] font-bold"
              style={{
                borderRadius: multiple ? "0.3rem" : "50%",
                borderColor: active ? "var(--xaccent2)" : "var(--xline)",
                backgroundColor: active ? "var(--xaccent2)" : "transparent",
                color: "#FFFFFF",
              }}
            >
              {active && "✓"}
            </span>
            {opt}
          </button>
        );
      })}
    </div>
  );
}
