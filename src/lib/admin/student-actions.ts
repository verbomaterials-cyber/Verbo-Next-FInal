"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { ActionResult } from "./actions";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    throw new Error("No autorizado");
  }
  return session;
}

function fail(error: unknown, fallback: string): { ok: false; error: string } {
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

const studentInput = z.object({
  fullName: z.string().min(2, "Nombre demasiado corto"),
  email: z.string().email("Email inválido"),
});

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
    await prisma.student.create({
      data: {
        fullName: data.fullName,
        email: data.email.toLowerCase().trim(),
        passwordHash: await bcrypt.hash(password, 12),
      },
    });
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
    await prisma.student.update({
      where: { id },
      data: { fullName: data.fullName, email: data.email.toLowerCase().trim() },
    });
    revalidatePath("/admin/alumnos");
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
}): Promise<ActionResult> {
  try {
    await requireAdmin();
    if (input.attemptsAllowed < 1) {
      return { ok: false, error: "Los intentos permitidos deben ser al menos 1." };
    }
    // Por defecto se desbloquean todas las versiones publicadas actuales;
    // el admin puede recortar después (ej. reservar Simulador 3).
    const published = await prisma.examVersion.findMany({
      where: { examTypeId: input.examTypeId, isPublished: true },
      select: { id: true },
    });
    await prisma.enrollment.create({
      data: {
        studentId: input.studentId,
        examTypeId: input.examTypeId,
        accessCode: generateAccessCode(),
        attemptsAllowed: input.attemptsAllowed,
        unlockedVersions: published.map((v) => v.id),
      },
    });
    revalidatePath("/admin/alumnos");
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
    if (patch.attemptsAllowed !== undefined && patch.attemptsAllowed < 1) {
      return { ok: false, error: "Los intentos permitidos deben ser al menos 1." };
    }
    await prisma.enrollment.update({ where: { id }, data: patch });
    revalidatePath("/admin/alumnos");
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
    revalidatePath("/admin/alumnos");
    return { ok: true, data: { accessCode } };
  } catch (e) {
    return fail(e, "No se pudo regenerar el código.");
  }
}

export async function deleteEnrollment(id: string): Promise<ActionResult> {
  try {
    await requireAdmin();
    await prisma.enrollment.delete({ where: { id } });
    revalidatePath("/admin/alumnos");
    return { ok: true };
  } catch (e) {
    return fail(e, "No se pudo eliminar el acceso.");
  }
}
