import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import type { ThemeConfig } from "@/lib/exam-config";
import { ExamTabs } from "./tabs";

export default async function ExamDetailLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}>) {
  const { slug } = await params;
  const exam = await prisma.examType.findUnique({ where: { slug } });
  if (!exam) notFound();

  const theme = exam.themeConfig as ThemeConfig;

  return (
    <div>
      <nav className="text-sm text-ink-muted">
        <Link href="/admin" className="hover:text-brand">
          Exámenes
        </Link>
        <span aria-hidden> / </span>
        <span className="text-ink">{exam.name}</span>
      </nav>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <span
          aria-hidden
          className="size-3.5 rounded-full"
          style={{ backgroundColor: theme?.palette?.accent ?? "#999" }}
        />
        <h1 className="text-2xl font-semibold tracking-tight">{exam.name}</h1>
        <span className="text-sm text-ink-muted">
          {exam.sectionOrderMode === "FIXED" ? "orden fijo" : "intercalado"} ·{" "}
          {exam.totalDurationMinutes} min
          {exam.hasAdaptiveLogic && " · adaptativo"}
        </span>
      </div>

      <ExamTabs slug={slug} />

      <div className="mt-8">{children}</div>
    </div>
  );
}
