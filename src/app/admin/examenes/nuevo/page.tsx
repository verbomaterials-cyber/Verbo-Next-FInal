import type { Metadata } from "next";
import { NewExamForm } from "./new-exam-form";

export const metadata: Metadata = { title: "Nuevo examen" };

export default function NewExamPage() {
  return (
    <div className="rise-in mx-auto max-w-2xl">
      <h1 className="text-2xl font-semibold tracking-tight">Nuevo examen</h1>
      <p className="mt-1 max-w-prose text-sm leading-relaxed text-ink-muted">
        Define el marco del examen. Después podrás construir sus secciones,
        tipos de pregunta y versiones desde su página de detalle.
      </p>
      <div className="mt-8">
        <NewExamForm />
      </div>
    </div>
  );
}
