"use server";

import { put } from "@vercel/blob";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/crypto";
import { getAccessibleApp, requireUser } from "@/lib/access";
import { createTemplate, listTemplates, parseRemoteTemplate, type NewTemplate } from "@/lib/gupshup";
import { friendlyError } from "@/lib/errors";
import { maxVar, fillText } from "@/lib/template-vars";
import { rateLimit } from "@/lib/rate-limit";
import { storeTemplates } from "@/lib/template-store";

export type TemplateState = { error?: string; field?: string } | undefined;

// WhatsApp limits for template parts.
const LIMITS = { name: 512, header: 60, body: 1024, footer: 60, button: 25, buttons: 3 };
const MEDIA: Record<string, { types: string[]; maxMb: number }> = {
  IMAGE: { types: ["image/jpeg", "image/png"], maxMb: 5 },
  VIDEO: { types: ["video/mp4", "video/3gpp"], maxMb: 4 },
  DOCUMENT: { types: ["application/pdf"], maxMb: 4 },
};

export async function uploadTemplateMediaAction(form: FormData): Promise<{ url?: string; error?: string }> {
  const user = await requireUser();
  if (!(await rateLimit(`upload:${user.id}`, 30, 10 * 60 * 1000))) return { error: "Too many uploads. Wait a few minutes." };
  const kind = String(form.get("kind") ?? "");
  const file = form.get("file");
  const rule = MEDIA[kind];
  if (!rule || !(file instanceof File) || file.size === 0) return { error: "Choose a file." };
  if (!rule.types.includes(file.type)) return { error: `Use ${rule.types.map((t) => t.split("/")[1].toUpperCase()).join(" or ")} for ${kind.toLowerCase()}.` };
  if (file.size > rule.maxMb * 1024 * 1024) return { error: `File is too big. Max ${rule.maxMb} MB here.` };
  const safe = file.name.replace(/[^\w.-]+/g, "_").slice(-80);
  const blob = await put(`template-media/${Date.now()}-${safe}`, file, { access: "public", contentType: file.type, addRandomSuffix: true });
  return { url: blob.url };
}

const s = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

export async function createTemplateAction(_: TemplateState, form: FormData): Promise<TemplateState> {
  const user = await requireUser();
  const app = await getAccessibleApp(user, s(form, "appId"));
  if (!app.gupshupAppId) return { error: "This number has no Gupshup app ID. Add it in the number's Settings first.", field: "appId" };
  if (!(await rateLimit(`tplcreate:${app.id}`, 8, 60 * 1000))) return { error: "Gupshup allows only a few submissions per minute. Wait a moment." };

  const elementName = s(form, "elementName");
  if (!/^[a-z0-9_]{1,512}$/.test(elementName)) {
    return { error: "Name can only use lowercase letters, numbers and underscores.", field: "elementName" };
  }
  const category = s(form, "category") as NewTemplate["category"];
  if (!["MARKETING", "UTILITY", "AUTHENTICATION"].includes(category)) return { error: "Pick a category.", field: "category" };
  const headerType = s(form, "headerType") || "NONE";
  const body = s(form, "body");
  const header = headerType === "TEXT" ? s(form, "headerText") : "";
  const footer = s(form, "footer");

  if (!body) return { error: "Write the message body.", field: "body" };
  if (body.length > LIMITS.body) return { error: `Body is ${body.length} characters. Max ${LIMITS.body}.`, field: "body" };
  if (header.length > LIMITS.header) return { error: `Header is too long. Max ${LIMITS.header}.`, field: "headerText" };
  if (footer.length > LIMITS.footer) return { error: `Footer is too long. Max ${LIMITS.footer}.`, field: "footer" };
  if (/\{\{/.test(footer)) return { error: "Footer cannot have variables.", field: "footer" };

  // Variables must be {{1}}, {{2}}... in order, with a sample for each.
  const nums = [...body.matchAll(/\{\{\s*(\d+)\s*\}\}/g)].map((m) => Number(m[1]));
  const bodyVars = maxVar(body);
  for (let i = 1; i <= bodyVars; i++) {
    if (!nums.includes(i)) return { error: `Variables must be numbered in order. {{${i}}} is missing.`, field: "body" };
  }
  if (/^\s*\{\{\d+\}\}|\{\{\d+\}\}\s*$/.test(body)) {
    return { error: "WhatsApp does not allow the body to start or end with a variable. Add a word before or after it.", field: "body" };
  }
  const bodySamples = Array.from({ length: bodyVars }, (_, i) => s(form, `bodySample${i + 1}`));
  if (bodySamples.some((v) => !v)) return { error: "Add a sample value for every variable. WhatsApp reviewers need them.", field: "samples" };
  const headerVars = maxVar(header);
  if (headerVars > 1) return { error: "A text header can have at most one variable, {{1}}.", field: "headerText" };
  const headerSample = headerVars ? s(form, "headerSample") : "";
  if (headerVars && !headerSample) return { error: "Add a sample for the header variable.", field: "samples" };

  let mediaUrl = "";
  let templateType: NewTemplate["templateType"] = "TEXT";
  if (["IMAGE", "VIDEO", "DOCUMENT"].includes(headerType)) {
    templateType = headerType as NewTemplate["templateType"];
    mediaUrl = s(form, "mediaUrl");
    if (!/^https:\/\/\S+$/.test(mediaUrl)) return { error: `Upload a sample ${headerType.toLowerCase()} or paste a public https link.`, field: "media" };
  }

  const buttons: NonNullable<NewTemplate["buttons"]> = [];
  for (let i = 0; i < LIMITS.buttons; i++) {
    const type = s(form, `btnType${i}`);
    const text = s(form, `btnText${i}`);
    if (!type || type === "NONE") continue;
    if (!text) return { error: `Button ${i + 1} needs a label.`, field: "buttons" };
    if (text.length > LIMITS.button) return { error: `Button ${i + 1} label is too long. Max ${LIMITS.button}.`, field: "buttons" };
    if (type === "URL") {
      const url = s(form, `btnValue${i}`);
      if (!/^https?:\/\/\S+$/.test(url)) return { error: `Button ${i + 1} needs a full website link.`, field: "buttons" };
      buttons.push({ type: "URL", text, url });
    } else if (type === "PHONE_NUMBER") {
      const phone = s(form, `btnValue${i}`).replace(/[^\d+]/g, "");
      if (!/^\+\d{8,15}$/.test(phone)) return { error: `Button ${i + 1} needs a phone number with + and country code.`, field: "buttons" };
      buttons.push({ type: "PHONE_NUMBER", text, phone_number: phone });
    } else {
      buttons.push({ type: "QUICK_REPLY", text });
    }
  }

  const exists = await prisma.template.findFirst({ where: { appId: app.id, elementName, status: { not: "DELETED" } } });
  if (exists) return { error: `A template named ${elementName} already exists on this number. Pick another name.`, field: "elementName" };

  const res = await createTemplate(decrypt(app.apiKeyEnc), app.gupshupAppId, {
    elementName,
    languageCode: s(form, "languageCode") || "en",
    category,
    templateType,
    vertical: s(form, "vertical") || elementName.replace(/_/g, " ").slice(0, 180),
    content: body,
    example: fillText(body, bodySamples),
    header: header || undefined,
    exampleHeader: header ? fillText(header, [headerSample]) : undefined,
    footer: footer || undefined,
    buttons,
    mediaUrl: mediaUrl || undefined,
    allowTemplateCategoryChange: form.get("allowCategoryChange") === "on",
  });
  if (!res.ok) return { error: friendlyError(res.error) ?? res.error };

  // Save straight away as pending, so it shows up without waiting for a sync.
  const t = parseRemoteTemplate(res.template);
  await prisma.template.upsert({
    where: { appId_gupshupId: { appId: app.id, gupshupId: t.id } },
    create: {
      appId: app.id,
      gupshupId: t.id,
      elementName: t.elementName,
      languageCode: t.languageCode,
      category: t.category,
      status: t.status,
      templateType: t.templateType,
      body: t.body || body,
      header: t.header ?? (header || null),
      footer: t.footer ?? (footer || null),
      buttons: buttons.length ? buttons : undefined,
      paramCount: t.paramCount,
      sampleMediaUrl: t.sampleMediaUrl ?? (mediaUrl || null),
      raw: t.raw as object,
    },
    update: {},
  });
  revalidatePath("/templates");
  revalidatePath(`/numbers/${app.id}`);
  redirect(`/templates?show=all&app=${app.id}&submitted=${encodeURIComponent(elementName)}`);
}

// Re-syncs one number's templates. Used by the auto-refresh while templates are pending.
export async function refreshPendingAction(appIds: string[]): Promise<{ changed: boolean }> {
  const user = await requireUser();
  let changed = false;
  for (const id of appIds.slice(0, 10)) {
    const app = await getAccessibleApp(user, id);
    const before = await prisma.template.count({ where: { appId: id, status: "PENDING" } });
    try {
      await storeTemplates(id, await listTemplates(decrypt(app.apiKeyEnc), app.gupshupAppName, app.gupshupAppId));
    } catch {
      continue;
    }
    const after = await prisma.template.count({ where: { appId: id, status: "PENDING" } });
    if (after !== before) changed = true;
  }
  return { changed };
}
