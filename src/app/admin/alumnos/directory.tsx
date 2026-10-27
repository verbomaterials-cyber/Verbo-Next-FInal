import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { StudentsManager } from "./students-manager";

export const metadata: Metadata = { title: "Alumnos" };



export async function StudentsDirectory({ searchParams, mode = "students" }: { searchParams: Promise<{ q?: string; examen?: string }>; mode?: "students" | "access" }) {
  const { q, examen } = await searchParams;

  const [students, examTypes, teachers] = await Promise.all([
    prisma.student.findMany({
      where: {
        ...(q
          ? {
              OR: [
                { fullName: { contains: q, mode: "insensitive" } },
                { email: { contains: q, mode: "insensitive" } },
              ],
            }
          : {}),
        ...(examen ? { enrollments: { some: { examTypeId: examen } } } : {}),
      },
      orderBy: { createdAt: "desc" },
      include: {
        enrollments: {
          include: { examType: { select: { id: true, name: true, slug: true } } },
        },
        _count: { select: { attempts: true } },
      },
    }),
    prisma.examType.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        examVersions: {
          orderBy: { label: "asc" },
          select: { id: true, label: true, isPublished: true },
        },
      },
    }),
    prisma.teacher.findMany({ orderBy: { fullName: "asc" }, select: { id: true, fullName: true, email: true, isActive: true } }),
  ]);

  return (
    <StudentsManager
      mode={mode}
      teachers={teachers}
      query={q ?? ""}
      examFilter={examen ?? ""}
      examTypes={examTypes}
      students={students.map((s) => ({
        id: s.id,
        fullName: s.fullName,
        email: s.email,
        teacherEmail: s.teacherEmail,
        teacherId: s.teacherId,
        isActive: s.isActive,
        createdAt: s.createdAt.toISOString().slice(0, 10),
        attemptCount: s._count.attempts,
        enrollments: s.enrollments.map((e) => ({
          id: e.id,
          examTypeId: e.examTypeId,
          examName: e.examType.name,
          examSlug: e.examType.slug,
          accessCode: e.accessCode,
          attemptsAllowed: e.attemptsAllowed,
          attemptsUsed: e.attemptsUsed,
          isBlocked: e.isBlocked,
          unlockedVersions: e.unlockedVersions,
        })),
      }))}
    />
  );
}

