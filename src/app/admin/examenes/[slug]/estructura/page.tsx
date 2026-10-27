import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { StructureManager } from "./structure-manager";

export const metadata: Metadata = { title: "Estructura" };

export default async function StructurePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const exam = await prisma.examType.findUnique({
    where: { slug },
    include: {
      sections: {
        orderBy: [{ order: "asc" }, { name: "asc" }],
        include: {
          questionTypes: {
            orderBy: { name: "asc" },
            include: { _count: { select: { questions: true } } },
          },
        },
      },
    },
  });
  if (!exam) notFound();

  return (
    <StructureManager
      slug={slug}
      examTypeId={exam.id}
      sectionOrderMode={exam.sectionOrderMode}
      subscoreDefinitions={exam.subscoreDefinitions as string[]}
      sections={exam.sections.map((s) => ({
        id: s.id,
        name: s.name,
        order: s.order,
        durationMinutes: s.durationMinutes,
        skillsMeasured: s.skillsMeasured,
        questionTypes: s.questionTypes.map((qt) => ({
          id: qt.id,
          name: qt.name,
          inputMedia: qt.inputMedia,
          responseType: qt.responseType,
          timingMode: qt.timingMode,
          timePerItemSeconds: qt.timePerItemSeconds,
          prepTimeSeconds: qt.prepTimeSeconds,
          replaysAllowed: qt.replaysAllowed,
          isScored: qt.isScored,
          subscoreMapping: qt.subscoreMapping,
          adminFieldSchema: JSON.stringify(qt.adminFieldSchema, null, 2),
          questionCount: qt._count.questions,
        })),
      }))}
    />
  );
}
