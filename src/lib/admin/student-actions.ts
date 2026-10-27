"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { getAppSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import type { ActionResult } from "./actions";
import { enrollmentCreateZ, enrollmentPatchZ, studentInputZ, eventKey } from "./access-validation";
import { queueEmail, scheduleEmails } from "@/lib/email";
import { reserveAccountEmail, teacherAssignment, AccountInputError } from "./accounts";

async function requireAdmin() {
  const session = await getAppSession();
  if (!session || session.user.role !== "ADMIN") {
    throw new Error("No autorizado");
  }
  return session;
}

function fail(error: unknown, fallback: string): { ok: false; error: string } {
  if (error instanceof AccountInputError) return { ok: false, error: error.message };
  if (error instanceof Error && ["El límite no puede ser menor a los intentos utilizados.", "Las versiones deben estar publicadas y pertenecer a este examen."].includes(error.message)) return { ok: false, error: error.message };
  if (error instanceof z.ZodError) {
    return { ok: false, error: error.issues.map((i) => i.message).join(" · ") };
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    return { ok: false, error: "Ya existe un registro con ese valor único (¿email o código repetido?)." };
  }
  console.error(fallback, error);
  return { ok: false, error: fallback };
}

/** Contraseña legible que se muestra una sola vez al admin. */
function generatePassword(): string {
  return crypto.randomBytes(9).toString("base64url");
}

/** Código de acceso corto y dictable por teléfono: sin 0/O ni 1/I/L. */
function generateAccessCode(): string {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const bytes = crypto.randomBytes(8);
  const chars = [...bytes].map((b) => alphabet[b % alphabet.length]);
  return `${chars.slice(0, 4).join("")}-${chars.slice(4).join("")}`;
}

/* ═══════════════ Alumnos ═══════════════ */

const studentInput = studentInputZ;

/** Vacío/omitido = generar una automática; si viene, se usa tal cual. */
const passwordInput = z
  .string()
  .min(6, "La contraseña necesita al menos 6 caracteres")
  .optional()
  .or(z.literal(""));

export async function createStudent(
  input: z.infer<typeof studentInput> & { password?: string },
): Promise<ActionResult<{ password: string }>> {
  try {
    await requireAdmin();
    const data = studentInput.parse(input);
    const chosenPassword = passwordInput.parse(input.password);
    const password = chosenPassword || generatePassword();
    await prisma.$transaction(async tx => {
    await reserveAccountEmail(tx, data.email);
    const assignment = await teacherAssignment(tx, data);
    const student = await tx.student.create({
      data: {
        fullName: data.fullName,
        email: data.email.toLowerCase().trim(),
        passwordHash: await bcrypt.hash(password, 12),
        ...assignment,
      },
    });
    await queueEmail(tx, { eventKey: `student:${student.id}:welcome`, recipient: student.email, subject: "Tu espacio está listo · Verbo NEXT", text: `Hola, ${student.fullName}.\n\nTu cuenta de Verbo NEXT está lista. Tu usuario es ${student.email}. Tu asesor te compartirá la contraseña por un canal privado y te avisará cuando tengas simuladores asignados.\n\nEntra en ${process.env.NEXTAUTH_URL ?? "https://next.verboacademic.com"}/login\n\nVerbo NEXT · Verbo Language Solutions` });
    });
    scheduleEmails();
    revalidatePath("/admin/alumnos");
    return { ok: true, data: { password } };
  } catch (e) {
    return fail(e, "No se pudo crear el alumno.");
  }
}

export async function updateStudent(
  id: string,
  input: z.infer<typeof studentInput>,
): Promise<ActionResult> {
  try {
    await requireAdmin();
    const data = studentInput.parse(input);
    await prisma.$transaction(async tx => {
    await reserveAccountEmail(tx, data.email, { kind: "student", id });
    const current = await tx.student.findUniqueOrThrow({ where: { id } });
    const assignment = await teacherAssignment(tx, data, current);
    await tx.student.update({
      where: { id },
      data: { fullName: data.fullName, email: data.email, ...assignment, ...(data.isActive !== undefined ? { isActive: data.isActive } : {}) },
    });
    });
    revalidateAccess();
    return { ok: true };
  } catch (e) {
    return fail(e, "No se pudo actualizar el alumno.");
  }
}

export async function resetStudentPassword(
  id: string,
  newPassword?: string,
): Promise<ActionResult<{ password: string }>> {
  try {
    await requireAdmin();
    const chosenPassword = passwordInput.parse(newPassword);
    const password = chosenPassword || generatePassword();
    await prisma.student.update({
      where: { id },
      data: { passwordHash: await bcrypt.hash(password, 12) },
    });
    return { ok: true, data: { password } };
  } catch (e) {
    return fail(e, "No se pudo restablecer la contraseña.");
  }
}

export async function deleteStudent(id: string): Promise<ActionResult> {
  try {
    await requireAdmin();
    // El cascade elimina enrollments, intentos y respuestas del alumno.
    await prisma.student.delete({ where: { id } });
    revalidatePath("/admin/alumnos");
    return { ok: true };
  } catch (e) {
    return fail(e, "No se pudo eliminar el alumno.");
  }
}

/* ═══════════════ Enrollments (accesos) ═══════════════ */

export async function createEnrollment(input: {
  studentId: string;
  examTypeId: string;
  attemptsAllowed: number;
  unlockedVersions?: string[];
}): Promise<ActionResult> {
  try {
    await requireAdmin();
    const data = enrollmentCreateZ.parse(input);
    // Por defecto se desbloquean todas las versiones publicadas actuales;
    // el admin puede recortar después (ej. reservar Simulador 3).
    const published = await prisma.examVersion.findMany({
      where: { examTypeId: input.examTypeId, isPublished: true },
      select: { id: true },
    });
    const versions = data.unlockedVersions ?? published.map(v => v.id);
    if (versions.some(id => !published.some(v => v.id === id))) return { ok: false, error: "Selecciona versiones publicadas de este examen." };
    await prisma.$transaction(async tx => {
    const enrollment = await tx.enrollment.create({
      data: {
        studentId: input.studentId,
        examTypeId: input.examTypeId,
        accessCode: generateAccessCode(),
        attemptsAllowed: data.attemptsAllowed,
        unlockedVersions: [...new Set(versions)],
      },
    });
    await queueAccessEmail(tx, enrollment.id, "Tus simuladores están listos · Verbo NEXT", `enrollment:${enrollment.id}:created`);
    });
    scheduleEmails();
    revalidateAccess();
    return { ok: true };
  } catch (e) {
    return fail(e, "No se pudo crear el acceso.");
  }
}

export async function updateEnrollment(
  id: string,
  patch: {
    attemptsAllowed?: number;
    isBlocked?: boolean;
    unlockedVersions?: string[];
  },
): Promise<ActionResult> {
  try {
    await requireAdmin();
    const data = enrollmentPatchZ.parse(patch);
    await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT "id" FROM "Enrollment" WHERE "id" = ${id} FOR UPDATE`;
      const enrollment = await tx.enrollment.findUniqueOrThrow({ where: { id } });
      if (data.attemptsAllowed !== undefined && data.attemptsAllowed < enrollment.attemptsUsed) throw new Error("El límite no puede ser menor a los intentos utilizados.");
      if (data.unlockedVersions) {
        const valid = await tx.examVersion.count({ where: { id: { in: [...new Set(data.unlockedVersions)] }, examTypeId: enrollment.examTypeId, isPublished: true } });
        if (valid !== new Set(data.unlockedVersions).size) throw new Error("Las versiones deben estar publicadas y pertenecer a este examen.");
      }
      await tx.enrollment.update({ where: { id }, data });
      if (data.isBlocked === false && enrollment.isBlocked || data.unlockedVersions?.some(v => !enrollment.unlockedVersions.includes(v))) await queueAccessEmail(tx, id, "Tu acceso se ha actualizado · Verbo NEXT", eventKey(`enrollment:${id}:updated`));
    });
    scheduleEmails();
    revalidateAccess();
    return { ok: true };
  } catch (e) {
    return fail(e, "No se pudo actualizar el acceso.");
  }
}

export async function regenerateAccessCode(
  id: string,
): Promise<ActionResult<{ accessCode: string }>> {
  try {
    await requireAdmin();
    const accessCode = generateAccessCode();
    await prisma.enrollment.update({ where: { id }, data: { accessCode } });
    revalidateAccess();
    return { ok: true, data: { accessCode } };
  } catch (e) {
    return fail(e, "No se pudo regenerar el código.");
  }
}

export async function deleteEnrollment(id: string): Promise<ActionResult> {
  try {
    await requireAdmin();
    await prisma.enrollment.delete({ where: { id } });
    revalidateAccess();
    return { ok: true };
  } catch (e) {
    return fail(e, "No se pudo eliminar el acceso.");
  }
}

function revalidateAccess() {
  revalidatePath("/admin", "layout");
  revalidatePath("/alumno", "layout");
  revalidatePath("/profesor", "layout");
}

async function queueAccessEmail(tx: Prisma.TransactionClient, id: string, subject: string, key: string) {
  const enrollment = await tx.enrollment.findUniqueOrThrow({ where: { id }, include: { student: true, examType: true } });
  if (enrollment.isBlocked || !enrollment.student.isActive) return;
  const labels = await tx.examVersion.findMany({ where: { id: { in: enrollment.unlockedVersions }, isPublished: true }, select: { label: true } });
  await queueEmail(tx, { eventKey: key, recipient: enrollment.student.email, subject, text: `Hola, ${enrollment.student.fullName}.\n\nTu acceso a ${enrollment.examType.name} está disponible.\nVersiones: ${labels.map(v => v.label).join(", ") || "Por asignar"}.\nIntentos disponibles: ${Math.max(0, enrollment.attemptsAllowed - enrollment.attemptsUsed)}.\nCódigo: ${enrollment.accessCode}\n\nEntra con tu cuenta en ${process.env.NEXTAUTH_URL ?? "https://next.verboacademic.com"}/alumno/examen/${enrollment.examType.slug}\n\nVerbo NEXT` });
}

export async function notifyEnrollment(id: string): Promise<ActionResult> {
  try {
    await requireAdmin();
    await prisma.$transaction(tx => queueAccessEmail(tx, id, "Tus accesos · Verbo NEXT", eventKey(`enrollment:${id}:notice`)));
    scheduleEmails();
    return { ok: true };
  } catch (error) { return fail(error, "No se pudo preparar el aviso."); }
}
