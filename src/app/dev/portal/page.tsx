import { notFound } from "next/navigation";
import { SignInView } from "@/components/signin-view";
export default function PortalPreview() {
  if (process.env.NODE_ENV !== "development") notFound();
  // Show the real sign-in component without changing an existing browser session.
  return <SignInView />;
}
