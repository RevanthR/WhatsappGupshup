import "server-only";
import { redirect, notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: "SUPER_ADMIN" | "USER";
  mustChangePassword: boolean;
};

export async function getUser(): Promise<SessionUser | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  return {
    id: session.user.id,
    name: session.user.name ?? "",
    email: session.user.email ?? "",
    role: session.user.role,
    mustChangePassword: session.user.mustChangePassword,
  };
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "SUPER_ADMIN") notFound();
  return user;
}

export const isAdmin = (u: SessionUser) => u.role === "SUPER_ADMIN";

// Filters for "things this user may see".
export function accountWhere(u: SessionUser): Prisma.GupshupAccountWhereInput {
  return isAdmin(u) ? {} : { access: { some: { userId: u.id } } };
}

export function appWhere(u: SessionUser): Prisma.AppWhereInput {
  return isAdmin(u) ? {} : { account: { access: { some: { userId: u.id } } } };
}

export async function getAccessibleApp(u: SessionUser, appId: string) {
  const app = await prisma.app.findFirst({ where: { id: appId, ...appWhere(u) }, include: { account: true } });
  if (!app) notFound();
  return app;
}

export async function getAccessibleAccount(u: SessionUser, accountId: string) {
  const account = await prisma.gupshupAccount.findFirst({ where: { id: accountId, ...accountWhere(u) } });
  if (!account) notFound();
  return account;
}

export async function listApps(u: SessionUser) {
  return prisma.app.findMany({
    where: { ...appWhere(u), active: true },
    include: { account: { select: { name: true } } },
    orderBy: [{ account: { name: "asc" } }, { name: "asc" }],
  });
}
