import { DefaultSession } from "next-auth";

export type AppRole = "ADMIN" | "STUDENT" | "TEACHER";

declare module "next-auth" {
  interface User {
    role: AppRole;
  }

  interface Session {
    user: {
      id: string;
      role: AppRole;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    uid: string;
    role: AppRole;
  }
}
