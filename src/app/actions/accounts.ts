"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { encrypt, randomToken } from "@/lib/crypto";
import { getAccessibleAccount, getAccessibleApp, isAdmin, requireAdmin, requireUser } from "@/lib/access";
import { listTemplates } from "@/lib/gupshup";
import { decrypt } from "@/lib/crypto";
import { normalizePhone } from "@/lib/phone";
import type { FormState } from "./auth";

const s = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

export async function createAccountAction(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const name = s(form, "name");
  if (!name) return { error: "Name is required." };
  let ownerId = user.id;
  if (isAdmin(user) && s(form, "ownerId")) ownerId = s(form, "ownerId");
  const account = await prisma.gupshupAccount.create({
    data: {
      name,
      notes: s(form, "notes") || null,
      ownerId,
      access: { create: { userId: ownerId } },
    },
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
  return { ok: "Saved." };
}

export async function deleteAccountAction(form: FormData) {
  const user = await requireUser();
  const account = await getAccessibleAccount(user, s(form, "id"));
  if (!isAdmin(user) && account.ownerId !== user.id) throw new Error("Only the owner or a super admin can delete this account.");
  await prisma.gupshupAccount.delete({ where: { id: account.id } });
  redirect("/accounts");
}

export async function setAccountAccessAction(_: FormState, form: FormData): Promise<FormState> {
  await requireAdmin();
  const accountId = s(form, "id");
  const userIds = form.getAll("userIds").map(String).filter(Boolean);
  const ownerId = s(form, "ownerId");
  await prisma.$transaction([
    prisma.accountAccess.deleteMany({ where: { accountId, userId: { notIn: userIds } } }),
    ...userIds.map((userId) =>
      prisma.accountAccess.upsert({
        where: { userId_accountId: { userId, accountId } },
        create: { userId, accountId },
        update: {},
      }),
    ),
    ...(ownerId ? [prisma.gupshupAccount.update({ where: { id: accountId }, data: { ownerId } })] : []),
  ]);
  revalidatePath(`/accounts/${accountId}`);
  return { ok: "Access updated." };
}

const appSchema = z.object({
  name: z.string().min(1, "Display name is required."),
  gupshupAppName: z.string().min(1, "Gupshup app name is required."),
  gupshupAppId: z.string().optional(),
  sourceNumber: z.string().min(1, "Sender number is required."),
});

export async function createAppAction(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const account = await getAccessibleAccount(user, s(form, "accountId"));
  const parsed = appSchema.safeParse({
    name: s(form, "name"),
    gupshupAppName: s(form, "gupshupAppName"),
    gupshupAppId: s(form, "gupshupAppId") || undefined,
    sourceNumber: s(form, "sourceNumber"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const apiKey = s(form, "apiKey");
  if (!apiKey) return { error: "API key is required." };
  const source = normalizePhone(parsed.data.sourceNumber);
  if (!source) return { error: "Sender number is not a valid phone number. Include the country code." };

  const app = await prisma.app.create({
    data: {
      accountId: account.id,
      name: parsed.data.name,
      gupshupAppName: parsed.data.gupshupAppName,
      gupshupAppId: parsed.data.gupshupAppId ?? null,
      sourceNumber: source,
      apiKeyEnc: encrypt(apiKey),
      apiKeyLast4: apiKey.slice(-4),
      webhookToken: randomToken(32),
    },
  });
  // Pull templates straight away. A bad key shows up on the app page.
  await syncTemplatesFor(app.id).catch(() => undefined);
  redirect(`/apps/${app.id}?created=1`);
}

export async function updateAppAction(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const app = await getAccessibleApp(user, s(form, "id"));
  const parsed = appSchema.safeParse({
    name: s(form, "name"),
    gupshupAppName: s(form, "gupshupAppName"),
    gupshupAppId: s(form, "gupshupAppId") || undefined,
    sourceNumber: s(form, "sourceNumber"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const source = normalizePhone(parsed.data.sourceNumber);
  if (!source) return { error: "Sender number is not a valid phone number. Include the country code." };
  const apiKey = s(form, "apiKey");
  await prisma.app.update({
    where: { id: app.id },
    data: {
      name: parsed.data.name,
      gupshupAppName: parsed.data.gupshupAppName,
      gupshupAppId: parsed.data.gupshupAppId ?? null,
      sourceNumber: source,
      active: form.get("active") === "on",
      ...(apiKey ? { apiKeyEnc: encrypt(apiKey), apiKeyLast4: apiKey.slice(-4) } : {}),
    },
  });
  revalidatePath(`/apps/${app.id}`);
  return { ok: apiKey ? "Saved. New API key stored." : "Saved." };
}

export async function deleteAppAction(form: FormData) {
  const user = await requireUser();
  const app = await getAccessibleApp(user, s(form, "id"));
  await prisma.app.delete({ where: { id: app.id } });
  redirect(`/accounts/${app.accountId}`);
}

export async function rotateWebhookAction(form: FormData) {
  const user = await requireUser();
  const app = await getAccessibleApp(user, s(form, "id"));
  await prisma.app.update({ where: { id: app.id }, data: { webhookToken: randomToken(32), lastWebhookAt: null } });
  revalidatePath(`/apps/${app.id}`);
}

async function syncTemplatesFor(appId: string): Promise<number> {
  const app = await prisma.app.findUniqueOrThrow({ where: { id: appId } });
  const remote = await listTemplates(decrypt(app.apiKeyEnc), app.gupshupAppName, app.gupshupAppId);
  await prisma.$transaction([
    ...remote.map((t) =>
      prisma.template.upsert({
        where: { appId_gupshupId: { appId, gupshupId: t.id } },
        create: {
          appId,
          gupshupId: t.id,
          elementName: t.elementName,
          languageCode: t.languageCode,
          category: t.category,
          status: t.status,
          templateType: t.templateType,
          body: t.body,
          header: t.header,
          footer: t.footer,
          buttons: (t.buttons as object) ?? undefined,
          paramCount: t.paramCount,
          sampleMediaUrl: t.sampleMediaUrl,
          raw: t.raw as object,
        },
        update: {
          elementName: t.elementName,
          languageCode: t.languageCode,
          category: t.category,
          status: t.status,
          templateType: t.templateType,
          body: t.body,
          header: t.header,
          footer: t.footer,
          buttons: (t.buttons as object) ?? undefined,
          paramCount: t.paramCount,
          sampleMediaUrl: t.sampleMediaUrl,
          raw: t.raw as object,
        },
      }),
    ),
    // Templates deleted in Gupshup are marked so, not removed, to keep history intact.
    prisma.template.updateMany({
      where: { appId, gupshupId: { notIn: remote.map((t) => t.id) } },
      data: { status: "DELETED" },
    }),
    prisma.app.update({ where: { id: appId }, data: { templatesSyncedAt: new Date() } }),
  ]);
  return remote.length;
}

export async function syncTemplatesAction(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const app = await getAccessibleApp(user, s(form, "id"));
  try {
    const n = await syncTemplatesFor(app.id);
    revalidatePath(`/apps/${app.id}`);
    return { ok: `Synced ${n} template${n === 1 ? "" : "s"} from Gupshup.` };
  } catch (e) {
    return { error: `Could not fetch templates. Check the API key, app ID and app name. (${(e as Error).message})` };
  }
}
