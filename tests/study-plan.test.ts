import {test} from "node:test";
import assert from "node:assert/strict";
import {goalScale,validGoalScore,mexicoWeek,studyPlanZ} from "../src/lib/study-plan";
test("goals preserve separate practice scales and reject official-score substitutions",()=>{assert.equal(goalScale("toefl-ibt")?.max,6);assert.equal(validGoalScore("toefl-ibt",4.5),true);for(const score of [0,4.7,7,120,NaN])assert.equal(validGoalScore("toefl-ibt",score),false);assert.equal(validGoalScore("det",0),true);assert.equal(validGoalScore("det",100),true);assert.equal(validGoalScore("det",160),false);assert.equal(validGoalScore("det",20.5),false);assert.equal(validGoalScore("unknown",null),true);assert.equal(validGoalScore("unknown",10),false);});
test("weeks start at Monday in Mexico City across the UTC midnight boundary",()=>{assert.equal(mexicoWeek(new Date("2026-10-26T03:00:00Z")).start.toISOString(),"2026-10-19T06:00:00.000Z");const week=mexicoWeek(new Date("2026-10-26T06:00:00Z"));assert.equal(week.start.toISOString(),"2026-10-26T06:00:00.000Z");assert.equal(week.end.toISOString(),"2026-11-02T06:00:00.000Z");assert.equal(mexicoWeek(new Date("2027-01-01T12:00:00Z")).start.toISOString(),"2026-12-28T06:00:00.000Z");});
test("plans validate real calendar dates, bounded weekly goals and distinct priorities",()=>{const plan={enrollmentId:"enrollment",targetScore:4.5,targetDate:"2028-02-29",weeklyGoal:3,focusSkills:["READING","WRITING"]};assert.equal(studyPlanZ.safeParse(plan).success,true);for(const patch of [{targetDate:"2027-02-29"},{targetDate:"2026-11-31"},{weeklyGoal:0},{weeklyGoal:2.5},{weeklyGoal:8},{focusSkills:["READING","READING"]},{teacherNote:"unauthorized write"}])assert.equal(studyPlanZ.safeParse({...plan,...patch}).success,false);});

import {currentTeacherRecipient} from "../src/lib/teacher/scope";
test("notification recipients follow explicit assignment and never fall back from a suspended teacher",()=>{
  assert.equal(currentTeacherRecipient({teacherId:"t",teacherEmail:"old@example.com",teacher:{email:"current@example.com",isActive:true}}),"current@example.com");
  assert.equal(currentTeacherRecipient({teacherId:"t",teacherEmail:"old@example.com",teacher:{email:"current@example.com",isActive:false}}),null);
  assert.equal(currentTeacherRecipient({teacherId:"missing",teacherEmail:"legacy@example.com",teacher:null}),null);
  assert.equal(currentTeacherRecipient({teacherId:null,teacherEmail:"notice-only@example.com"}),"notice-only@example.com");
});
