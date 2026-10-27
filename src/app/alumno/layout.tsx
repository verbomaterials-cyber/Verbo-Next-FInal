import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PortalShell } from "@/components/portal-shell";
export default async function StudentLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (session.user.role !== "STUDENT") redirect("/admin");
  const student = await prisma.student.findUnique({ where: { id: session.user.id }, select: { fullName: true } });
  if (!student) redirect("/login");
  return <PortalShell role="student" name={student.fullName}>{children}</PortalShell>;
}
