"use server";

import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/access";

export type UserState = { error?: string; ok?: string; tempPassword?: string; email?: string } | undefined;

const tempPassword = () => randomBytes(9).toString("base64url");

export async function createUserAction(_: UserState, form: FormData): Promise<UserState> {
  await requireAdmin();
  const name = String(form.get("name") ?? "").trim();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const role = form.get("role") === "SUPER_ADMIN" ? "SUPER_ADMIN" : "USER";
  if (!name) return { error: "Name is required." };
  if (!/^\S+@\S+\.\S+$/.test(email)) return { error: "Enter a valid email." };
  if (await prisma.user.findUnique({ where: { email } })) return { error: "A user with this email already exists." };
  const password = tempPassword();
  const accountIds = form.getAll("accountIds").map(String).filter(Boolean);
  await prisma.user.create({
    data: {
      name,
      email,
      role,
      passwordHash: await bcrypt.hash(password, 10),
      mustChangePassword: true,
      accounts: { create: accountIds.map((accountId) => ({ accountId })) },
    },
  });
  revalidatePath("/users");
  return { ok: `${name} added.`, tempPassword: password, email };
}

export async function updateUserAction(_: UserState, form: FormData): Promise<UserState> {
  const admin = await requireAdmin();
  const id = String(form.get("id") ?? "");
  const name = String(form.get("name") ?? "").trim();
  const role = form.get("role") === "SUPER_ADMIN" ? "SUPER_ADMIN" : "USER";
  const active = form.get("active") === "on";
  if (!name) return { error: "Name is required." };
  if (id === admin.id && (role !== "SUPER_ADMIN" || !active)) {
    return { error: "You cannot demote or disable yourself." };
  }
  const accountIds = form.getAll("accountIds").map(String).filter(Boolean);
  await prisma.$transaction([
    prisma.user.update({ where: { id }, data: { name, role, active } }),
    prisma.accountAccess.deleteMany({ where: { userId: id, accountId: { notIn: accountIds } } }),
    ...accountIds.map((accountId) =>
      prisma.accountAccess.upsert({
        where: { userId_accountId: { userId: id, accountId } },
        create: { userId: id, accountId },
        update: {},
      }),
    ),
  ]);
  revalidatePath("/users");
  return { ok: "Saved." };
}

export async function resetPasswordAction(_: UserState, form: FormData): Promise<UserState> {
  await requireAdmin();
  const id = String(form.get("id") ?? "");
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) return { error: "User not found." };
  const password = tempPassword();
  await prisma.user.update({
    where: { id },
    data: { passwordHash: await bcrypt.hash(password, 10), mustChangePassword: true },
  });
  return { ok: "Password reset.", tempPassword: password, email: user.email };
}
