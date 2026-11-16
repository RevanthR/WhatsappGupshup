"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { decrypt, encrypt, randomToken } from "@/lib/crypto";
import { accountWhere, getAccessibleAccount, getAccessibleApp, isAdmin, requireAdmin, requireUser } from "@/lib/access";
import { listTemplates, type RemoteTemplate } from "@/lib/gupshup";
import { storeTemplates } from "@/lib/template-store";
import { friendlyError } from "@/lib/errors";
import { normalizePhone } from "@/lib/phone";
import { rateLimit } from "@/lib/rate-limit";
import type { FormState } from "./auth";

const s = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

/* ---------------- Gupshup accounts ---------------- */

export async function createAccountAction(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const name = s(form, "name");
  if (!name) return { error: "Name is required." };
  let ownerId = user.id;
  if (isAdmin(user) && s(form, "ownerId")) ownerId = s(form, "ownerId");
  const account = await prisma.gupshupAccount.create({
    data: { name, notes: s(form, "notes") || null, ownerId, access: { create: { userId: ownerId } } },
  });
  redirect(`/accounts/${account.id}`);
}

export async function updateAccountAction(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const account = await getAccessibleAccount(user, s(form, "id"));
  const name = s(form, "name");
  if (!name) return { error: "Name is required." };
  await prisma.gupshupAccount.update({ where: { id: account.id }, data: { name, notes: s(form, "notes") || null } });
  revalidatePath(`/accounts/${account.id}`);
  return { ok: "Account saved." };
}

export async function deleteAccountAction(form: FormData) {
  const user = await requireUser();
  const account = await getAccessibleAccount(user, s(form, "id"));
  if (!isAdmin(user) && account.ownerId !== user.id) throw new Error("Only the owner or a super admin can delete this account.");
  await prisma.gupshupAccount.delete({ where: { id: account.id } });
  redirect("/numbers");
}

export async function setAccountAccessAction(_: FormState, form: FormData): Promise<FormState> {
  await requireAdmin();
  const accountId = s(form, "id");
  const userIds = form.getAll("userIds").map(String).filter(Boolean);
  const ownerId = s(form, "ownerId");
  await prisma.$transaction([
    prisma.accountAccess.deleteMany({ where: { accountId, userId: { notIn: userIds } } }),
    ...userIds.map((userId) =>
      prisma.accountAccess.upsert({ where: { userId_accountId: { userId, accountId } }, create: { userId, accountId }, update: {} }),
    ),
    ...(ownerId ? [prisma.gupshupAccount.update({ where: { id: accountId }, data: { ownerId } })] : []),
  ]);
  revalidatePath(`/accounts/${accountId}`);
  return { ok: "Access updated." };
}

/* ---------------- Connection test ---------------- */

export type VerifyResult =
  | { ok: true; total: number; approved: number; names: string[] }
  | { ok: false; error: string; detail: string };

function explain(e: unknown): { error: string; detail: string } {
  const detail = (e as Error).message ?? String(e);
  return {
    error: friendlyError(detail) ?? "Gupshup did not accept these details. Check the app name, app ID and API key.",
    detail,
  };
}

// Calls Gupshup with the given details (or the saved key for an existing number).
export async function verifyConnectionAction(input: {
  appId?: string;
  gupshupAppName: string;
  gupshupAppId: string;
  apiKey: string;
}): Promise<VerifyResult> {
  const user = await requireUser();
  if (!(await rateLimit(`verify:${user.id}`, 20, 10 * 60 * 1000))) {
    return { ok: false, error: "Too many tests. Wait a few minutes.", detail: "" };
  }
  let apiKey = input.apiKey.trim();
  if (!apiKey && input.appId) apiKey = decrypt((await getAccessibleApp(user, input.appId)).apiKeyEnc);
  if (!apiKey) return { ok: false, error: "Paste the API key first.", detail: "" };
  if (!input.gupshupAppName.trim()) return { ok: false, error: "Enter the Gupshup app name first.", detail: "" };
  try {
    const list = await listTemplates(apiKey, input.gupshupAppName.trim(), input.gupshupAppId.trim() || null);
    const approved = list.filter((t) => t.status === "APPROVED");
    return { ok: true, total: list.length, approved: approved.length, names: approved.slice(0, 5).map((t) => t.elementName) };
  } catch (e) {
    return { ok: false, ...explain(e) };
  }
}

/* ---------------- WhatsApp numbers (Gupshup apps) ---------------- */

const appSchema = z.object({
  name: z.string().min(1, "Give this number a name."),
  gupshupAppName: z.string().min(1, "Gupshup app name is required."),
  gupshupAppId: z.string().optional(),
  sourceNumber: z.string().min(1, "WhatsApp number is required."),
});

function readApp(form: FormData) {
  return appSchema.safeParse({
    name: s(form, "name"),
    gupshupAppName: s(form, "gupshupAppName"),
    gupshupAppId: s(form, "gupshupAppId") || undefined,
    sourceNumber: s(form, "sourceNumber"),
  });
}

export async function createNumberAction(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();

  // Account: pick an existing one or create a new one inline.
  let accountId = s(form, "accountId");
  const newAccountName = s(form, "newAccountName");
  if (accountId === "__new" || !accountId) {
    if (!newAccountName) return { error: "Name the Gupshup account (usually the business name)." };
  } else {
    await getAccessibleAccount(user, accountId);
  }

  const parsed = readApp(form);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const apiKey = s(form, "apiKey");
  if (!apiKey) return { error: "API key is required." };
  const source = normalizePhone(parsed.data.sourceNumber);
  if (!source) return { error: "WhatsApp number is not valid. Include the country code, e.g. +91 98765 43210." };

  let remote: RemoteTemplate[];
  try {
    remote = await listTemplates(apiKey, parsed.data.gupshupAppName, parsed.data.gupshupAppId ?? null);
  } catch (e) {
    const x = explain(e);
    return { error: `${x.error} (${x.detail})` };
  }

  if (accountId === "__new" || !accountId) {
    const account = await prisma.gupshupAccount.create({
      data: { name: newAccountName, ownerId: user.id, access: { create: { userId: user.id } } },
    });
    accountId = account.id;
  }

  const app = await prisma.app.create({
    data: {
      accountId,
      name: parsed.data.name,
      gupshupAppName: parsed.data.gupshupAppName,
      gupshupAppId: parsed.data.gupshupAppId ?? null,
      sourceNumber: source,
      apiKeyEnc: encrypt(apiKey),
      apiKeyLast4: apiKey.slice(-4),
      webhookToken: randomToken(32),
      keyVerifiedAt: new Date(),
    },
  });
  await storeTemplates(app.id, remote);
  redirect(`/numbers/${app.id}?tab=webhook&new=1`);
}

export async function updateAppAction(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const app = await getAccessibleApp(user, s(form, "id"));
  const parsed = readApp(form);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const source = normalizePhone(parsed.data.sourceNumber);
  if (!source) return { error: "WhatsApp number is not valid. Include the country code." };
  const apiKey = s(form, "apiKey");

  // If anything Gupshup checks has changed, test it before saving.
  const credsChanged =
    !!apiKey ||
    parsed.data.gupshupAppName !== app.gupshupAppName ||
    (parsed.data.gupshupAppId ?? null) !== app.gupshupAppId;
  let remote: RemoteTemplate[] | null = null;
  if (credsChanged) {
    try {
      remote = await listTemplates(apiKey || decrypt(app.apiKeyEnc), parsed.data.gupshupAppName, parsed.data.gupshupAppId ?? null);
    } catch (e) {
      const x = explain(e);
      return { error: `Not saved. ${x.error} (${x.detail})` };
    }
  }
  await prisma.app.update({
    where: { id: app.id },
    data: {
      name: parsed.data.name,
      gupshupAppName: parsed.data.gupshupAppName,
      gupshupAppId: parsed.data.gupshupAppId ?? null,
      sourceNumber: source,
      active: form.get("active") === "on",
      ...(apiKey ? { apiKeyEnc: encrypt(apiKey), apiKeyLast4: apiKey.slice(-4) } : {}),
      ...(credsChanged ? { keyVerifiedAt: new Date(), lastSyncError: null } : {}),
    },
  });
  if (remote) await storeTemplates(app.id, remote);
  revalidatePath(`/numbers/${app.id}`);
  return { ok: credsChanged ? "Saved and verified with Gupshup. Templates refreshed." : "Saved." };
}

export async function deleteAppAction(form: FormData) {
  const user = await requireUser();
  const app = await getAccessibleApp(user, s(form, "id"));
  await prisma.app.delete({ where: { id: app.id } });
  redirect("/numbers");
}

export async function rotateWebhookAction(form: FormData) {
  const user = await requireUser();
  const app = await getAccessibleApp(user, s(form, "id"));
  await prisma.app.update({ where: { id: app.id }, data: { webhookToken: randomToken(32), lastWebhookAt: null } });
  revalidatePath(`/numbers/${app.id}`);
}

/* ---------------- Templates ---------------- */

async function syncTemplatesFor(appId: string): Promise<number> {
  const app = await prisma.app.findUniqueOrThrow({ where: { id: appId } });
  try {
    const remote = await listTemplates(decrypt(app.apiKeyEnc), app.gupshupAppName, app.gupshupAppId);
    await storeTemplates(appId, remote);
    return remote.length;
  } catch (e) {
    await prisma.app.update({ where: { id: appId }, data: { lastSyncError: (e as Error).message.slice(0, 500) } });
    throw e;
  }
}

export async function syncTemplatesAction(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const app = await getAccessibleApp(user, s(form, "id"));
  try {
    const n = await syncTemplatesFor(app.id);
    revalidatePath(`/numbers/${app.id}`);
    revalidatePath("/templates");
    return { ok: `Synced ${n} template${n === 1 ? "" : "s"} from Gupshup.` };
  } catch (e) {
    revalidatePath(`/numbers/${app.id}`);
    const x = explain(e);
    return { error: `${x.error} (${x.detail})` };
  }
}

// Syncs every number the user can see. Used by the Templates page.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function syncAllTemplatesAction(_: FormState): Promise<FormState> {
  const user = await requireUser();
  const apps = await prisma.app.findMany({
    where: { active: true, account: accountWhere(user) },
    select: { id: true, name: true },
  });
  if (apps.length === 0) return { error: "No WhatsApp numbers connected yet." };
  const results = await Promise.allSettled(apps.map((a) => syncTemplatesFor(a.id)));
  const failed = apps.filter((_, i) => results[i].status === "rejected").map((a) => a.name);
  const total = results.reduce((n, r) => n + (r.status === "fulfilled" ? r.value : 0), 0);
  revalidatePath("/templates");
  if (failed.length) return { error: `Synced ${total} templates. Could not sync: ${failed.join(", ")}. Open those numbers to see why.` };
  return { ok: `Synced ${total} template${total === 1 ? "" : "s"} across ${apps.length} number${apps.length === 1 ? "" : "s"}.` };
}
