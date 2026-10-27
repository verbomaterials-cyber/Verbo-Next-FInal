import {prisma} from "@/lib/prisma";
import {mexicoWeek,goalScale} from "@/lib/study-plan";
export async function loadStudyPlans(studentId:string){
  const week=mexicoWeek();
  const enrollments=await prisma.enrollment.findMany({where:{studentId},orderBy:{createdAt:"asc"},select:{id:true,targetScore:true,targetDate:true,weeklyGoal:true,focusSkills:true,teacherNote:true,isBlocked:true,attemptsAllowed:true,attemptsUsed:true,examTypeId:true,examType:{select:{name:true,slug:true}}}});
  return Promise.all(enrollments.map(async plan=>{
    const where={studentId,examVersion:{examTypeId:plan.examTypeId}};
    const scale=goalScale(plan.examType.slug);
    const [submitted,latest,latestScore]=await Promise.all([
      prisma.attempt.count({where:{...where,status:{not:"IN_PROGRESS"},completedAt:{gte:week.start,lt:week.end}}}),
      prisma.attempt.findFirst({where:{...where,status:{not:"IN_PROGRESS"}},orderBy:{completedAt:"desc"},select:{id:true,status:true}}),
      scale?prisma.attempt.findFirst({where:{...where,status:"COMPLETED",overallScore:{path:["scoringVersion"],equals:scale.version}},orderBy:{completedAt:"desc"},select:{overallScore:true}}):null,
    ]);
    return {...plan,submitted,latest,latestScore:latestScore?.overallScore??null};
  }));
}
