import { redirect } from "next/navigation";
import { getAppSession } from "@/lib/session";
import { PortalShell } from "@/components/portal-shell";
import { roleHome } from "@/lib/portal";
export default async function StudentLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const session = await getAppSession();
  if (!session) redirect("/login");
  if (session.user.role !== "STUDENT") redirect(roleHome(session.user.role));
  return <PortalShell role="student" name={session.user.name ?? "Alumno"}>{children}</PortalShell>;
}
