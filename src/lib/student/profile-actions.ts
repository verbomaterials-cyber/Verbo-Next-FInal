"use server";
import { revalidatePath } from "next/cache";
import { getAppSession } from "../session";
import { prisma } from "../prisma";
import { profileNameZ } from "./profile-validation";

export async function updateProfile(input: unknown) {
  const session = await getAppSession();
  if (!session || session.user.role !== "STUDENT") return { ok: false as const, error: "Tu sesión expiró. Vuelve a iniciar sesión." };
  const parsed = profileNameZ.safeParse((input as { fullName?: unknown } | null)?.fullName);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0].message };
  try {
    // Ownership comes from the session, never from a submitted student ID.
    const student = await prisma.student.update({ where: { id: session.user.id }, data: { fullName: parsed.data }, select: { fullName: true } });
    revalidatePath("/alumno", "layout");
    return { ok: true as const, fullName: student.fullName };
  } catch { return { ok: false as const, error: "No pudimos guardar tu nombre. Inténtalo de nuevo." }; }
}
