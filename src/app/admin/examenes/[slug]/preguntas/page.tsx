import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import type { AdminFieldSchema } from "@/lib/exam-config";
import { QuestionWorkbench } from "./workbench";

export const metadata: Metadata = { title: "Preguntas" };

export default async function QuestionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ version?: string; tipo?: string }>;
}) {
  const { slug } = await params;
  const { version: versionParam, tipo: tipoParam } = await searchParams;

  const exam = await prisma.examType.findUnique({
    where: { slug },
    include: {
      examVersions: { orderBy: { label: "asc" } },
      sections: {
        orderBy: [{ order: "asc" }, { name: "asc" }],
        include: { questionTypes: { orderBy: { name: "asc" } } },
      },
    },
  });
  if (!exam) notFound();

  const selectedVersion =
    exam.examVersions.find((v) => v.id === versionParam) ?? exam.examVersions[0] ?? null;

  const allTypes = exam.sections.flatMap((s) =>
    s.questionTypes.map((qt) => ({ ...qt, sectionName: s.name })),
  );
  const selectedType = allTypes.find((t) => t.id === tipoParam) ?? null;

  const questions = selectedVersion
    ? await prisma.question.findMany({
        where: {
          examVersionId: selectedVersion.id,
          ...(selectedType ? { questionTypeId: selectedType.id } : {}),
        },
        orderBy: { order: "asc" },
        include: { questionType: { select: { name: true } } },
      })
    : [];

  return (
    <QuestionWorkbench
      slug={slug}
      versions={exam.examVersions.map((v) => ({
        id: v.id,
        label: v.label,
        hasFeedback: v.hasFeedback,
        isPublished: v.isPublished,
      }))}
      selectedVersionId={selectedVersion?.id ?? null}
      sections={exam.sections.map((s) => ({
        name: s.name,
        questionTypes: s.questionTypes.map((qt) => ({
          id: qt.id,
          name: qt.name,
          isScored: qt.isScored,
          adminFieldSchema: qt.adminFieldSchema as AdminFieldSchema,
        })),
      }))}
      selectedTypeId={selectedType?.id ?? null}
      questions={questions.map((q) => ({
        id: q.id,
        order: q.order,
        typeName: q.questionType.name,
        questionTypeId: q.questionTypeId,
        promptContent: q.promptContent as Record<string, unknown>,
        correctAnswer: q.correctAnswer as Record<string, unknown> | null,
        feedbackText: q.feedbackText,
        difficultyLevel: q.difficultyLevel,
      }))}
    />
  );
}
