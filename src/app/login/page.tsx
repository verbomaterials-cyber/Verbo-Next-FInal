import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { SignInView } from "@/components/signin-view";
export const metadata: Metadata = { title: "Bienvenido de nuevo" };
export default async function LoginPage() {
  const session = await getServerSession(authOptions);
  if (session) redirect(session.user.role === "ADMIN" ? "/admin" : "/alumno");
  return <SignInView />;
}
