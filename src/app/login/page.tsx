import type { Metadata } from "next";
import { SignInView } from "@/components/signin-view";
export const metadata: Metadata = { title: "Bienvenido de nuevo" };
export default function LoginPage() {
  return <SignInView />;
}
