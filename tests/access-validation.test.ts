import {test} from "node:test";
import assert from "node:assert/strict";
import { enrollmentCreateZ,enrollmentPatchZ,studentInputZ } from "../src/lib/admin/access-validation";
test("access limits reject fractional, infinite, excessive and coerced values",()=>{
  for(const value of [0,-1,1.5,Infinity,NaN,10001,"4",null]) {
    assert.equal(enrollmentCreateZ.safeParse({studentId:"s",examTypeId:"e",attemptsAllowed:value}).success,false);
    assert.equal(enrollmentPatchZ.safeParse({attemptsAllowed:value}).success,false);
  }
  assert.equal(enrollmentCreateZ.parse({studentId:"s",examTypeId:"e",attemptsAllowed:4,unlockedVersions:[]}).attemptsAllowed,4);
  assert.equal(enrollmentPatchZ.safeParse({attemptsUsed:0}).success,false);
});
test("profiles normalize student and teacher emails and validate account state",()=>{
  const profile=studentInputZ.parse({fullName:"  Ana Pérez  ",email:"  ANA@example.com ",teacherEmail:" Teacher@EXAMPLE.com ",isActive:false});
  assert.equal(profile.fullName,"Ana Pérez");assert.equal(profile.email,"ana@example.com");assert.equal(profile.teacherEmail,"teacher@example.com");assert.equal(profile.isActive,false);
  assert.equal(studentInputZ.safeParse({...profile,teacherEmail:"not-an-email"}).success,false);
});
