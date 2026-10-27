import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAppSession } from "@/lib/session";
import { SignInView } from "@/components/signin-view";
import { roleHome } from "@/lib/portal";
export const metadata: Metadata = { title: "Bienvenido de nuevo" };
export default async function LoginPage() {
  const session = await getAppSession();
  if (session) redirect(roleHome(session.user.role));
  return <SignInView />;
}
