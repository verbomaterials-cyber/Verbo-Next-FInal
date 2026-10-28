"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { reviewResponse } from "@/lib/admin/review-actions";
import { Badge, Button, ErrorNote, Field, Textarea } from "@/components/ui";
import { deliveryMetadata } from "@/lib/toefl-delivery";
import { rubricAssessmentZ, toeflRubrics } from "@/lib/toefl-rubrics";
import { detMetadata, detRubric, detListeningRubric, detAssessmentZ } from "@/lib/det-format";

type OpenResponse = {
  id: string;
  questionOrder: number;
  typeName: string;
  responseType: string;
  isScored: boolean;
  isFlagged: boolean;
  isCorrect: boolean | null;
  reviewNotes: string | null;
  reviewAssessment: unknown;
  promptContent: Record<string, unknown>;
  answerContent: Record<string, unknown>;
};

export function ReviewPanel({ responses }: { responses: OpenResponse[] }) {
  const firstPending = responses.find(r => r.isCorrect === null)?.id;
  return (
    <div className="space-y-5">
      {responses.map((r) => (
        <details key={r.id} open={r.id === firstPending} className="rounded-xl border border-line bg-surface p-4">
          <summary className="cursor-pointer text-sm font-medium">#{r.questionOrder} · {r.typeName} · {r.isCorrect === null ? "Por revisar" : "Evaluada"}{r.isFlagged ? " · Duda del alumno" : ""}</summary>
          <div className="mt-4"><ResponseCard response={r} /></div>
        </details>
      ))}
    </div>
  );
}

function ResponseCard({ response }: { response: OpenResponse }) {
  const router = useRouter();
  const [notes, setNotes] = useState(response.reviewNotes ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const det = detMetadata(response.promptContent);
  const assessment = (det ? detAssessmentZ : rubricAssessmentZ).safeParse(response.reviewAssessment);
  const [score, setScore] = useState<number | "">(assessment.success ? assessment.data.score : "");
  const rubric = det ? det.task==="listen-complete"?detListeningRubric:detRubric : deliveryMetadata(response.promptContent) ? toeflRubrics[response.typeName] : undefined;

  const reviewed = response.isCorrect !== null;
  const studentText =
    typeof response.answerContent.text === "string" ? response.answerContent.text : Array.isArray(response.answerContent.answers)?response.answerContent.answers.join(" · "):null;
  const recording =
    response.answerContent.recorded === true
      ? `Grabación de ${response.answerContent.durationSeconds}s${response.answerContent.recordingId ? "" : " (registro antiguo sin archivo de audio)"}.`
      : response.answerContent.recorded === false
        ? "El alumno no pudo grabar (micrófono no disponible)."
        : null;

  async function submit(verdict: "correct" | "incorrect" | "reviewed") {
    setSaving(true);
    setError(null);
    const result = await reviewResponse({ responseId: response.id, verdict, reviewNotes: notes, ...(rubric && score !== "" ? { rubricScore: score } : {}) });
    if (!result.ok) {
      setError(result.error);
      setSaving(false);
      return;
    }
    router.refresh();
    setSaving(false);
  }

  return (
    <div className="rounded-xl border border-line bg-surface p-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-xs text-ink-muted">#{response.questionOrder}</span>
        <span className="text-sm font-medium">{response.typeName}</span>
        <Badge tone="brand">{det?.task==="listen-complete"?"listening":response.responseType === "AUDIO_RECORDING" ? "speaking" : "writing"}</Badge>
        {!response.isScored && <Badge>no puntúa — solo revisión</Badge>}
        {response.isFlagged && <Badge tone="warning">duda del alumno 🚩</Badge>}
        <span className="ml-auto">
          {reviewed ? (
            <Badge tone="success">
              revisada{assessment.success ? ` · ${assessment.data.score}/5` : response.isScored ? (response.isCorrect ? " · correcta" : " · incorrecta") : ""}
            </Badge>
          ) : (
            <Badge tone="warning">pendiente</Badge>
          )}
        </span>
      </div>

      {typeof response.answerContent.audioUrl === "string" && response.answerContent.recordingId != null && (
        <audio preload="none" className="mt-3 w-full" controls src={response.answerContent.audioUrl} aria-label="Respuesta oral del alumno" />
      )}

      <div className="mt-3 rounded-lg bg-background px-4 py-3 text-sm leading-relaxed">
        <p className="mb-1 text-xs font-medium text-ink-muted">Pregunta</p>
        <p className="whitespace-pre-wrap">{promptSummary(response.promptContent)}</p>
      </div>

      <div className="mt-2 rounded-lg bg-background px-4 py-3 text-sm leading-relaxed">
        <p className="mb-1 text-xs font-medium text-ink-muted">Respuesta del alumno</p>
        {studentText ? (
          <p className="whitespace-pre-wrap">{studentText}</p>
        ) : (
          <p className="text-ink-muted">{recording ?? JSON.stringify(response.answerContent)}</p>
        )}
      </div>

      <div className="mt-3">
        <Field
          label="Notas de revisión"
          help="El alumno las verá en sus resultados; úsalas como feedback de la sesión en vivo."
        >
          <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
      </div>

      <ErrorNote>{error}</ErrorNote>

      {rubric && <section className="mt-5 rounded-lg border border-line bg-background p-4">
        <h3 className="text-sm font-semibold">Rúbrica de práctica · {response.typeName}</h3>
        <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-ink-muted">{rubric.criteria.map((criterion) => <li key={criterion}>{criterion}</li>)}</ul>
        <label className="mt-4 block text-sm font-medium">Puntuación holística (0–5)
          <select value={score} onChange={(event) => setScore(event.target.value === "" ? "" : Number(event.target.value))} className="mt-2 w-full rounded-lg border border-line bg-surface p-2 text-sm">
            <option value="">Selecciona una puntuación</option>{rubric.levels.map((_, value) => <option key={value} value={value}>{value} de 5</option>)}
          </select>
        </label>
        {score !== "" && <p className="mt-3 text-sm leading-relaxed">{rubric.levels[score]}</p>}
        <details className="mt-3 text-xs"><summary className="cursor-pointer">Consultar todos los niveles</summary><ol className="mt-3 space-y-2" start={0}>{rubric.levels.map((description, value) => <li key={value}><b>{value}:</b> {description}</li>)}</ol></details>
      </section>}

      <div className="mt-3 flex flex-wrap gap-2">
        {rubric ? <Button size="sm" disabled={saving || score === ""} onClick={() => submit("reviewed")}>Guardar evaluación</Button> : response.isScored ? (
          <>
            <Button size="sm" disabled={saving} onClick={() => submit("correct")}>
              ✓ Correcta
            </Button>
            <Button size="sm" variant="outline" disabled={saving} onClick={() => submit("incorrect")}>
              ✗ Incorrecta
            </Button>
          </>
        ) : (
          <Button size="sm" disabled={saving} onClick={() => submit("reviewed")}>
            Marcar revisada
          </Button>
        )}
      </div>
    </div>
  );
}

function promptSummary(prompt: Record<string, unknown>): string {
  const parts: string[] = [];
  if(Array.isArray(prompt.blanks))parts.push(...prompt.blanks.map(b=>String(b.text??"")));
  for (const value of Object.values(prompt)) {
    if (typeof value === "string" && value.trim() && !value.startsWith("data:") && !value.startsWith("http") && !value.startsWith("/audio/")) {
      parts.push(value);
    }
  }
  return parts.join("\n").slice(0, 600) || "(contenido multimedia)";
}
