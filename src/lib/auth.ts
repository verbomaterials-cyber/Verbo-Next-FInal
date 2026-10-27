import type { NextAuthOptions, Session } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";

// Hash de relleno: se compara siempre aunque el email no exista,
// para que el tiempo de respuesta no revele qué correos están registrados.
const DUMMY_HASH = "$2a$12$C6UzMDM.H6dfI/f/IKcEeO7ZBpQtKcXWXhzZ1jZ8mYVGgXqQO8qW6";

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    CredentialsProvider({
      name: "Credenciales",
      credentials: {
        email: { label: "Correo", type: "email" },
        password: { label: "Contraseña", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials.password) return null;
        const email = credentials.email.toLowerCase().trim();

        const admin = await prisma.adminUser.findUnique({ where: { email } });
        if (admin) {
          const ok = await bcrypt.compare(credentials.password, admin.passwordHash);
          if (!ok) return null;
          return { id: admin.id, email: admin.email, name: "Administrador", role: "ADMIN" as const };
        }

        const teacher = await prisma.teacher.findUnique({ where: { email } });
        if (teacher) {
          const ok = await bcrypt.compare(credentials.password, teacher.passwordHash);
          if (!ok || !teacher.isActive) return null;
          return { id: teacher.id, email: teacher.email, name: teacher.fullName, role: "TEACHER" as const };
        }
        const student = await prisma.student.findUnique({ where: { email } });
        if (student) {
          const ok = await bcrypt.compare(credentials.password, student.passwordHash);
          if (!ok || !student.isActive) return null;
          return { id: student.id, email: student.email, name: student.fullName, role: "STUDENT" as const };
        }

        await bcrypt.compare(credentials.password, DUMMY_HASH);
        return null;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.uid = user.id;
        token.role = user.role;
      }
      const account = token.role === "ADMIN"
        ? await prisma.adminUser.findUnique({ where: { id: token.uid }, select: { passwordHash: true } })
        : token.role === "TEACHER"
          ? await prisma.teacher.findUnique({ where: { id: token.uid }, select: { passwordHash: true, isActive: true } })
          : await prisma.student.findUnique({ where: { id: token.uid }, select: { passwordHash: true, isActive: true } });
      const stamp = account ? createHash("sha256").update(account.passwordHash).digest("hex") : "";
      if (user) token.authStamp = stamp;
      token.invalid = !account || ("isActive" in account && !account.isActive) || token.authStamp !== stamp;
      return token;
    },
    async session({ session, token }) {
      // NextAuth's session route accepts an empty session; getServerSession returns null.
      // Password resets and account suspension revoke previously issued sessions.
      if (token.invalid) return null as unknown as Session;
      if (session.user) {
        session.user.id = token.uid;
        session.user.role = token.role;
      }
      return session;
    },
  },
};
