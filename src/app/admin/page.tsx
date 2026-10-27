import Link from "next/link";
import { prisma } from "@/lib/prisma";
import type { ThemeConfig } from "@/lib/exam-config";

export default async function AdminHome() {
  const exams = await prisma.examType.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      _count: { select: { enrollments: true, examVersions: true } },
    },
  });

  const questionCounts = await Promise.all(
    exams.map((e) =>
      prisma.question.count({ where: { examVersion: { examTypeId: e.id } } }),
    ),
  );

  return (
    <div className="rise-in">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Exámenes</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Catálogo de simuladores. Cada examen define su propia estructura,
            preguntas y tema visual.
          </p>
        </div>
        <Link
          href="/admin/examenes/nuevo"
          className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white shadow-sm transition-[background-color,transform] duration-150 ease-(--ease-out) hover:bg-brand-strong active:scale-[0.97]"
        >
          + Nuevo examen
        </Link>
      </div>

      {exams.length === 0 ? (
        <div className="mt-10 rounded-xl border border-dashed border-line-strong px-8 py-14 text-center">
          <p className="text-sm text-ink-muted">
            Aún no hay exámenes. Crea el primero con “+ Nuevo examen”.
          </p>
        </div>
      ) : (
        <ul className="mt-8 grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
          {exams.map((exam, i) => {
            const theme = exam.themeConfig as ThemeConfig;
            return (
              <li key={exam.id} className="stagger-in">
                <Link
                  href={`/admin/examenes/${exam.slug}/estructura`}
                  className="hover-lift group block rounded-2xl border border-line bg-surface p-5 shadow-sm transition-[border-color,transform] duration-150 ease-(--ease-out) hover:border-line-strong hover:shadow-md"
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      aria-hidden
                      className="size-3 rounded-full"
                      style={{ backgroundColor: theme?.palette?.accent ?? "#999" }}
                    />
                    <h2 className="font-semibold tracking-tight group-hover:text-brand">
                      {exam.name}
                    </h2>
                  </div>
                  <p className="mt-2 line-clamp-2 min-h-10 text-sm leading-relaxed text-ink-muted">
                    {exam.description}
                  </p>
                  <dl className="mt-4 flex flex-wrap gap-x-5 gap-y-1 border-t border-line pt-4 text-sm">
                    <div className="flex gap-1.5">
                      <dt className="text-ink-muted">Preguntas</dt>
                      <dd className="font-medium">{questionCounts[i]}</dd>
                    </div>
                    <div className="flex gap-1.5">
                      <dt className="text-ink-muted">Alumnos</dt>
                      <dd className="font-medium">{exam._count.enrollments}</dd>
                    </div>
                    <div className="flex gap-1.5">
                      <dt className="text-ink-muted">Versiones</dt>
                      <dd className="font-medium">{exam._count.examVersions}</dd>
                    </div>
                  </dl>
                  <p className="mt-3 text-xs text-ink-muted">
                    {exam.sectionOrderMode === "FIXED"
                      ? "Secciones en orden fijo"
                      : "Tipos de pregunta intercalados"}
                    {" · "}
                    {exam.totalDurationMinutes} min
                    {exam.hasAdaptiveLogic && " · adaptativo"}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
