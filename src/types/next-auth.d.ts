import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: "SUPER_ADMIN" | "USER";
      mustChangePassword: boolean;
    } & DefaultSession["user"];
  }

  interface User {
    role: "SUPER_ADMIN" | "USER";
    mustChangePassword: boolean;
  }
}
