import type { Metadata } from "next";
import type { Prisma } from "@prisma/client";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { StudentsManager } from "./students-manager";

export const metadata: Metadata = { title: "Alumnos" };



export async function StudentsDirectory({ searchParams, mode = "students" }: { searchParams: Promise<{ q?: string; examen?: string; pagina?:string }>; mode?: "students" | "access" }) {
  const { q, examen, pagina } = await searchParams;
  const requested=Number(pagina),page=Number.isInteger(requested)&&requested>0?Math.min(requested,10000):1;
  const where:Prisma.StudentWhereInput={
    ...(q?{OR:[{fullName:{contains:q,mode:"insensitive"}},{email:{contains:q,mode:"insensitive"}}]}:{}),
    ...(examen?{enrollments:{some:{examTypeId:examen}}}:{})
  };

  const [students, examTypes, teachers, total] = await Promise.all([
    prisma.student.findMany({
      where,
      orderBy: [{ createdAt: "desc" },{id:"desc"}],
      take:30,skip:(page-1)*30,
      select: {
        id:true,fullName:true,email:true,teacherEmail:true,teacherId:true,isActive:true,createdAt:true,
        enrollments: {
          select: {id:true,examTypeId:true,accessCode:true,attemptsAllowed:true,attemptsUsed:true,isBlocked:true,unlockedVersions:true,examType: { select: { id: true, name: true, slug: true } } },
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
    prisma.student.count({where}),
  ]);
  const pageHref=(n:number)=>`${mode==="access"?"/admin/accesos":"/admin/alumnos"}?${new URLSearchParams({q:q??"",examen:examen??"",pagina:String(n)})}`;

  return (
    <><StudentsManager
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
    {total>30&&<nav aria-label="Páginas de alumnos" className="mt-6 flex items-center justify-between gap-4"><span className="text-sm text-ink-muted">{total} alumnos · Página {page} de {Math.ceil(total/30)}</span><div className="flex gap-5">{page>1&&<Link prefetch={false} href={pageHref(page-1)} className="text-link">← Anterior</Link>}{page*30<total&&<Link prefetch={false} href={pageHref(page+1)} className="text-link">Siguiente →</Link>}</div></nav>}
    </>
  );
}

