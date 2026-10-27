import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { VersionsManager } from "./versions-manager";

export const metadata: Metadata = { title: "Versiones" };

export default async function VersionsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const exam = await prisma.examType.findUnique({
    where: { slug },
    include: {
      examVersions: {
        orderBy: { label: "asc" },
        include: { _count: { select: { questions: true, attempts: true } } },
      },
    },
  });
  if (!exam) notFound();

  return (
    <VersionsManager
      slug={slug}
      examTypeId={exam.id}
      versions={exam.examVersions.map((v) => ({
        id: v.id,
        label: v.label,
        hasFeedback: v.hasFeedback,
        isPublished: v.isPublished,
        questionCount: v._count.questions,
        attemptCount: v._count.attempts,
      }))}
    />
  );
}
