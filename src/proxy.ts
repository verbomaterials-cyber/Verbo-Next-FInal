import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

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

  if (pathname.startsWith("/admin") && token.role !== "ADMIN") {
    return NextResponse.redirect(new URL("/alumno", req.url));
  }

  if (pathname.startsWith("/alumno") && token.role !== "STUDENT") {
    return NextResponse.redirect(new URL("/admin", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/alumno/:path*"],
};
