import { redirect } from "next/navigation";
import { getAppSession } from "@/lib/session";
import { PortalShell } from "@/components/portal-shell";
import { roleHome } from "@/lib/portal";
export default async function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const session = await getAppSession();
  if (!session) redirect("/login");
  if (session.user.role !== "ADMIN") redirect(roleHome(session.user.role));
  return <PortalShell role="admin" name={session.user.email ?? "Administrador"}>{children}</PortalShell>;
}
