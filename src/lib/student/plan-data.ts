import {prisma} from "@/lib/prisma";
import {mexicoWeek} from "@/lib/study-plan";
import type {Prisma,AttemptStatus} from "@prisma/client";
export async function loadStudyPlans(studentId:string){
  const week=mexicoWeek();
  const enrollments=await prisma.enrollment.findMany({where:{studentId},orderBy:{createdAt:"asc"},select:{id:true,targetScore:true,targetDate:true,weeklyGoal:true,focusSkills:true,teacherNote:true,isBlocked:true,attemptsAllowed:true,attemptsUsed:true,examTypeId:true,examType:{select:{name:true,slug:true}}}});
  if(!enrollments.length)return [];
  // Aggregate on the database server: one compact round trip for every plan,
  // instead of fetching three separate result sets per enrollment.
  const metrics=await prisma.$queryRaw<{id:string;submitted:number;latest:{id:string;status:AttemptStatus}|null;latestScore:Prisma.JsonValue|null}[]>`
    SELECT e.id,
      (SELECT count(*)::int FROM "Attempt" a JOIN "ExamVersion" v ON v.id=a."examVersionId"
        WHERE a."studentId"=e."studentId" AND v."examTypeId"=e."examTypeId"
          AND a.status <> 'IN_PROGRESS' AND a."completedAt">=${week.start.toISOString()}::timestamp AND a."completedAt"<${week.end.toISOString()}::timestamp) AS submitted,
      (SELECT json_build_object('id',a.id,'status',a.status) FROM "Attempt" a JOIN "ExamVersion" v ON v.id=a."examVersionId"
        WHERE a."studentId"=e."studentId" AND v."examTypeId"=e."examTypeId" AND a.status <> 'IN_PROGRESS'
        ORDER BY a."completedAt" DESC,a.id DESC LIMIT 1) AS latest,
      (SELECT a."overallScore" FROM "Attempt" a JOIN "ExamVersion" v ON v.id=a."examVersionId"
        WHERE a."studentId"=e."studentId" AND v."examTypeId"=e."examTypeId" AND a.status='COMPLETED'
          AND a."overallScore"->>'scoringVersion'=CASE t.slug WHEN 'det' THEN 'verbo-det-practice-v1' WHEN 'toefl-ibt' THEN 'verbo-toefl-practice-v1' ELSE NULL END
        ORDER BY a."completedAt" DESC,a.id DESC LIMIT 1) AS "latestScore"
    FROM "Enrollment" e JOIN "ExamType" t ON t.id=e."examTypeId" WHERE e."studentId"=${studentId}
  `;
  const byId=new Map(metrics.map(m=>[m.id,m]));
  return enrollments.map(plan=>{const m=byId.get(plan.id);return {...plan,submitted:m?.submitted??0,latest:m?.latest??null,latestScore:m?.latestScore??null};});
}
