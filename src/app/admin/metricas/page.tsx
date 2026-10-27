import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui";
import { MetricsFilters } from "./filters";

export const metadata: Metadata = { title: "Métricas" };

/*
 * Convención de scores (la calcula el motor en la capa 6):
 *  - Attempt.overallScore = { "value": number }
 *  - Attempt.subscores    = { "<subscore>": number, ... }
 */

function scoreValue(overallScore: unknown): number | null {
  if (
    overallScore &&
    typeof overallScore === "object" &&
    "value" in overallScore &&
    typeof (overallScore as { value: unknown }).value === "number"
  ) {
    return (overallScore as { value: number }).value;
  }
  return null;
}
function scoreFamily(value:unknown) {
  const version=(value as {scoringVersion?:string}|null)?.scoringVersion;
  return version==="verbo-det-practice-v1"?"Índice de práctica DET · 0–100":version==="verbo-toefl-practice-v1"?"Banda de práctica TOEFL · 1–6":"Formato anterior";
}

export default async function MetricsPage({
  searchParams,
}: {
  searchParams: Promise<{ examen?: string; alumno?: string }>;
}) {
  const { examen, alumno } = await searchParams;

  const [examTypes, students, pending] = await Promise.all([
    prisma.examType.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, subscoreDefinitions: true },
    }),
    prisma.student.findMany({
      orderBy: { fullName: "asc" },
      select: { id: true, fullName: true },
    }),
    prisma.attempt.findMany({
      where: { status: "PENDING_REVIEW" },
      orderBy: { completedAt: "asc" },
      include: {
        student: { select: { fullName: true } },
        examVersion: {
          select: { label: true, examType: { select: { name: true } } },
        },
        _count: { select: { responses: { where: { isCorrect: null } } } },
      },
    }),
  ]);

  const selectedExam = examTypes.find((e) => e.id === examen) ?? null;
  const selectedStudent = students.find((s) => s.id === alumno) ?? null;

  /* ── Por examen: distribución + preguntas más flaggeadas ── */
  let examStats: {
    total: number;
    distributions: {label:string;scores:number[]}[];
    flagged: { count: number; typeName: string; versionLabel: string; excerpt: string }[];
  } | null = null;

  if (selectedExam) {
    const attempts = await prisma.attempt.findMany({
      where: {
        examVersion: { examTypeId: selectedExam.id },
        status: { in: ["COMPLETED", "PENDING_REVIEW"] },
      },
      select: { overallScore: true },
    });

    const flaggedGroups = await prisma.response.groupBy({
      by: ["questionId"],
      where: {
        isFlagged: true,
        question: { examVersion: { examTypeId: selectedExam.id } },
      },
      _count: { questionId: true },
      orderBy: { _count: { questionId: "desc" } },
      take: 10,
    });

    const flaggedQuestions = await prisma.question.findMany({
      where: { id: { in: flaggedGroups.map((g) => g.questionId) } },
      include: {
        questionType: { select: { name: true } },
        examVersion: { select: { label: true } },
      },
    });

    examStats = {
      total: attempts.length,
      distributions: [...new Set(attempts.map(a=>scoreFamily(a.overallScore)))].map(label=>({label,scores:attempts.filter(a=>scoreFamily(a.overallScore)===label).map(a=>scoreValue(a.overallScore)).filter((v):v is number=>v!==null)})),
      flagged: flaggedGroups.map((g) => {
        const q = flaggedQuestions.find((x) => x.id === g.questionId);
        const prompt = (q?.promptContent ?? {}) as Record<string, unknown>;
        const firstText =
          Object.values(prompt).find((v) => typeof v === "string" && v.trim()) ?? "";
        return {
          count: g._count.questionId,
          typeName: q?.questionType.name ?? "—",
          versionLabel: q?.examVersion.label ?? "—",
          excerpt: String(firstText).slice(0, 80),
        };
      }),
    };
  }

  /* ── Por alumno: Diagnóstico vs Simuladores ── */
  let studentStats:
    | {
        examName: string;
        subscoreNames: string[];
        rows: {
          version: string;
          date: string;
          status: string;
          score: number | null;
          subscores: (number | null)[];
        }[];
      }[]
    | null = null;

  if (selectedStudent) {
    const attempts = await prisma.attempt.findMany({
      where: { studentId: selectedStudent.id },
      orderBy: { startedAt: "asc" },
      include: {
        examVersion: {
          select: {
            label: true,
            examType: { select: { id: true, name: true, subscoreDefinitions: true } },
          },
        },
      },
    });

    const byExam = new Map<string, typeof attempts>();
    for (const a of attempts) {
      const key = `${a.examVersion.examType.id}:${scoreFamily(a.overallScore)}`;
      byExam.set(key, [...(byExam.get(key) ?? []), a]);
    }

    studentStats = [...byExam.values()].map((group) => {
      const examType = group[0].examVersion.examType;
      const family=scoreFamily(group[0].overallScore);
      const subscoreNames = family==="Índice de práctica DET · 0–100"?["Reading","Listening","Writing","Speaking"]:examType.subscoreDefinitions as string[];
      return {
        examName: `${examType.name} · ${family}`,
        subscoreNames,
        rows: group.map((a) => {
          const subs = (a.subscores ?? {}) as Record<string, unknown>;
          return {
            version: a.examVersion.label,
            date: a.startedAt.toISOString().slice(0, 10),
            status: a.status,
            score: scoreValue(a.overallScore),
            subscores: subscoreNames.map((n) =>
              typeof subs[n] === "number" ? (subs[n] as number) : null,
            ),
          };
        }),
      };
    });
  }

  return (
    <div className="rise-in space-y-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Métricas</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Progreso de alumnos, distribución de resultados y dudas marcadas.
        </p>
      </div>

      {/* ── Pendientes de revisión ── */}
      <section>
        <h2 className="font-semibold tracking-tight">
          Pendientes de revisión
          {pending.length > 0 && (
            <span className="ml-2 rounded-full bg-danger-soft px-2 py-0.5 text-xs font-medium text-danger">
              {pending.length}
            </span>
          )}
        </h2>
        <p className="mt-1 text-sm text-ink-muted">
          Intentos con respuestas abiertas (writing/speaking) esperando tu calificación.
        </p>
        {pending.length === 0 ? (
          <p className="mt-4 rounded-xl border border-dashed border-line px-6 py-8 text-center text-sm text-ink-muted">
            Nada pendiente por ahora.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-xl border border-line bg-surface">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs text-ink-muted">
                  <th className="px-4 py-2.5 font-medium">Alumno</th>
                  <th className="px-4 py-2.5 font-medium">Examen</th>
                  <th className="px-4 py-2.5 font-medium">Versión</th>
                  <th className="px-4 py-2.5 font-medium">Completado</th>
                  <th className="px-4 py-2.5 font-medium">Sin calificar</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {pending.map((a) => (
                  <tr key={a.id}>
                    <td className="px-4 py-2.5 font-medium">{a.student.fullName}</td>
                    <td className="px-4 py-2.5">{a.examVersion.examType.name}</td>
                    <td className="px-4 py-2.5">{a.examVersion.label}</td>
                    <td className="px-4 py-2.5 text-ink-muted">
                      {a.completedAt?.toISOString().slice(0, 16).replace("T", " ") ?? "—"}
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge tone="warning">{a._count.responses} respuesta(s)</Badge>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <Link
                        href={`/admin/revision/${a.id}`}
                        className="font-medium text-brand hover:underline"
                      >
                        Calificar →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <MetricsFilters
        examTypes={examTypes.map((e) => ({ id: e.id, name: e.name }))}
        students={students}
        selectedExamId={selectedExam?.id ?? ""}
        selectedStudentId={selectedStudent?.id ?? ""}
      />

      {/* ── Por examen ── */}
      {selectedExam && examStats && (
        <section>
          <h2 className="font-semibold tracking-tight">
            {selectedExam.name} — {examStats.total} intento(s)
          </h2>

          <div className="mt-4 grid gap-6 lg:grid-cols-2">
            <div className="rounded-xl border border-line bg-surface p-5">
              <h3 className="text-sm font-medium">Distribución de scores</h3>
              {examStats.distributions.every(d=>!d.scores.length) ? (
                <p className="mt-4 text-sm text-ink-muted">
                  Sin intentos calificados todavía.
                </p>
              ) : (
                <div className="space-y-5">{examStats.distributions.filter(d=>d.scores.length).map(d=><div key={d.label}><p className="mt-3 text-xs text-ink-muted">{d.label}</p><ScoreDistribution scores={d.scores}/></div>)}</div>
              )}
            </div>

            <div className="rounded-xl border border-line bg-surface p-5">
              <h3 className="text-sm font-medium">Preguntas más marcadas con duda</h3>
              {examStats.flagged.length === 0 ? (
                <p className="mt-4 text-sm text-ink-muted">
                  Ningún alumno ha marcado preguntas todavía.
                </p>
              ) : (
                <ul className="mt-3 divide-y divide-line">
                  {examStats.flagged.map((f, i) => (
                    <li key={i} className="flex items-center justify-between gap-3 py-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-sm">{f.excerpt || "(sin texto)"}</p>
                        <p className="text-xs text-ink-muted">
                          {f.typeName} · {f.versionLabel}
                        </p>
                      </div>
                      <Badge tone="brand">{f.count} 🚩</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ── Por alumno ── */}
      {selectedStudent && studentStats && (
        <section>
          <h2 className="font-semibold tracking-tight">
            Progreso de {selectedStudent.fullName}
          </h2>
          {studentStats.length === 0 ? (
            <p className="mt-4 rounded-xl border border-dashed border-line px-6 py-8 text-center text-sm text-ink-muted">
              Este alumno aún no tiene intentos.
            </p>
          ) : (
            studentStats.map((exam) => (
              <div key={exam.examName} className="mt-4">
                <h3 className="text-sm font-medium text-ink-muted">{exam.examName}</h3>
                <div className="mt-2 overflow-x-auto rounded-xl border border-line bg-surface">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-line text-left text-xs text-ink-muted">
                        <th className="px-4 py-2.5 font-medium">Versión</th>
                        <th className="px-4 py-2.5 font-medium">Fecha</th>
                        <th className="px-4 py-2.5 font-medium">Estado</th>
                        <th className="px-4 py-2.5 font-medium">Score</th>
                        {exam.subscoreNames.map((n) => (
                          <th key={n} className="px-4 py-2.5 font-medium">
                            {n}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {exam.rows.map((row, i) => (
                        <tr key={i}>
                          <td className="px-4 py-2.5 font-medium">{row.version}</td>
                          <td className="px-4 py-2.5 text-ink-muted">{row.date}</td>
                          <td className="px-4 py-2.5">
                            <Badge
                              tone={
                                row.status === "COMPLETED"
                                  ? "success"
                                  : row.status === "PENDING_REVIEW"
                                    ? "warning"
                                    : "neutral"
                              }
                            >
                              {row.status === "IN_PROGRESS"
                                ? "en curso"
                                : row.status === "COMPLETED"
                                  ? "completado"
                                  : "por revisar"}
                            </Badge>
                          </td>
                          <td className="px-4 py-2.5 font-mono">
                            {row.score ?? "—"}
                          </td>
                          {row.subscores.map((s, j) => (
                            <td key={j} className="px-4 py-2.5 font-mono text-ink-muted">
                              {s ?? "—"}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))
          )}
        </section>
      )}
    </div>
  );
}

/* Distribución simple con barras CSS (sin librería de charts). */
function ScoreDistribution({ scores }: { scores: number[] }) {
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  const bucketCount = 8;
  const size = Math.max((max - min) / bucketCount, 1);
  const buckets = Array.from({ length: bucketCount }, (_, i) => {
    const from = min + i * size;
    const to = i === bucketCount - 1 ? max : min + (i + 1) * size;
    const count = scores.filter((s) => s >= from && (i === bucketCount - 1 ? s <= to : s < to)).length;
    return { label: `${Math.round(from)}–${Math.round(to)}`, count };
  });
  const peak = Math.max(...buckets.map((b) => b.count), 1);

  return (
    <div className="mt-4 space-y-1.5">
      {buckets.map((b) => (
        <div key={b.label} className="flex items-center gap-3">
          <span className="w-20 shrink-0 text-right font-mono text-xs text-ink-muted">
            {b.label}
          </span>
          <div className="h-4 flex-1 rounded-sm bg-background">
            <div
              className="h-full rounded-sm bg-brand"
              style={{ width: `${(b.count / peak) * 100}%` }}
            />
          </div>
          <span className="w-6 shrink-0 font-mono text-xs text-ink-muted">{b.count}</span>
        </div>
      ))}
    </div>
  );
}
