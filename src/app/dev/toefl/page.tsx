import { notFound } from "next/navigation";
import diagnostic from "../../../../content/toefl-2026/diagnostic.json";
import { toeflSeed } from "../../../../prisma/seed-data/toefl-2026";
import { studentQuestionPayload } from "@/lib/student/question-payload";
import { ToeflPreview } from "./preview";
import type { EngineQuestion } from "@/components/exam/question-renderer";
import { toeflForm } from "../../../../content/toefl-2026/forms";
import { delivered, deliveryMetadata, moduleSeconds } from "@/lib/toefl-delivery";

export default async function ToeflPreviewPage({ searchParams }: { searchParams: Promise<{ form?: string; route?: string }> }) {
  if (process.env.NODE_ENV !== "development") notFound();
  const search = await searchParams;
  const fullLength = ["1", "2", "3"].includes(search.form ?? "");
  const form = fullLength ? toeflForm(search.form) : null;
  const branch = search.route === "lower" ? "lower" : "upper";
  const routes = { Reading: { branch, earned: 0, possible: 20, threshold: .65 }, Listening: { branch, earned: 0, possible: 20, threshold: .65 } } as const;
  const source = form ? form.data.questions.filter((q) => delivered(deliveryMetadata(q.prompt), routes)) : diagnostic.questions;
  const questions: EngineQuestion[] = source.map((item, index) => {
    const meta = deliveryMetadata(item.prompt);
    const section = toeflSeed.sections.find((section) => section.questionTypes.some((type) => type.name === item.questionType))!;
    const type = section.questionTypes.find((type) => type.name === item.questionType)!;
    const payload = studentQuestionPayload(type.adminFieldSchema, item.prompt, type.responseType);
    const seconds = meta && moduleSeconds(meta);
    return { id: `preview-${index}`, order: index, promptContent: payload.prompt,
      itemCount: item.questionType === "Complete the Words" ? ((item.answer as { answers?: unknown[] } | null)?.answers?.length ?? 1) : 1,
      module: meta && meta.module !== "linear" ? { id: `${meta.section}-${meta.module}`, number: meta.module === "router" ? 1 : 2 } : undefined,
      questionType: {
      id: `type-${index}`, name: type.name, inputMedia: type.inputMedia, responseType: type.responseType,
      timingMode: type.timingMode, timePerItemSeconds: meta?.responseSeconds ?? type.timePerItemSeconds ?? null,
      prepTimeSeconds: type.prepTimeSeconds ?? null, replaysAllowed: type.replaysAllowed ?? null,
      isScored: type.isScored, sectionId: section.name, adminFieldSchema: { ...payload.schema, ...(seconds ? { timingGroup: { key: `${meta!.section}-${meta!.module}`, durationSeconds: seconds } } : {}) },
    } };
  });
  return <ToeflPreview key={`${form?.number}-${branch}`} questions={questions} fullLength={fullLength} formLabel={form?.label} />;
}
