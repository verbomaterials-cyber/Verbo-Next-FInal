import { randomUUID } from "node:crypto";
import { z } from "zod";
export const enrollmentCreateZ = z.object({ studentId:z.string().min(1), examTypeId:z.string().min(1), attemptsAllowed:z.number().int().min(1).max(10000), unlockedVersions:z.array(z.string().min(1)).max(100).optional() });
export const enrollmentPatchZ = z.object({ attemptsAllowed:z.number().int().min(1).max(10000).optional(), isBlocked:z.boolean().optional(), unlockedVersions:z.array(z.string().min(1)).max(100).optional() }).strict();
export const studentInputZ = z.object({ fullName:z.string().trim().min(2).max(100), email:z.string().trim().toLowerCase().email(), teacherId:z.string().nullable().optional(), teacherEmail:z.union([z.string().trim().toLowerCase().email(),z.literal("")]).optional(), isActive:z.boolean().optional() });
export function eventKey(prefix:string) { return `${prefix}:${randomUUID()}`; }
