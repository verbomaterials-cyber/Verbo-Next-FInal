import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { roleHome } from "@/lib/portal";

// Protección por rol: un STUDENT jamás alcanza /admin/*, y viceversa.
// Las layouts de cada área repiten la verificación en el servidor
// (defensa en profundidad) — el middleware es la primera barrera.
export default async function proxy(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  const { pathname } = req.nextUrl;

  if (!token) {
    const login = new URL("/login", req.url);
    login.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(login);
  }

  const required = pathname.startsWith("/admin") ? "ADMIN" : pathname.startsWith("/profesor") ? "TEACHER" : "STUDENT";
  if (token.role !== required) return NextResponse.redirect(new URL(roleHome(token.role), req.url));

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/alumno/:path*", "/profesor/:path*"],
};
