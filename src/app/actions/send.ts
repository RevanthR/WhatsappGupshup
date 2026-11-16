"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getAccessibleApp, requireUser } from "@/lib/access";
import { normalizePhone } from "@/lib/phone";
import { varLabels } from "@/lib/template-vars";
import { needsMedia, sendTemplateNow, sendTextNow, windowOpen } from "@/lib/send";

export type SendState = { error?: string; ok?: string; messageId?: string } | undefined;

export async function sendSingleAction(_: SendState, form: FormData): Promise<SendState> {
  const user = await requireUser();
  const app = await getAccessibleApp(user, String(form.get("appId") ?? ""));
  if (!app.active) return { error: "This app is disabled." };
  const template = await prisma.template.findFirst({ where: { id: String(form.get("templateId") ?? ""), appId: app.id } });
  if (!template) return { error: "Pick a template." };
  if (template.status !== "APPROVED") return { error: "Only approved templates can be sent." };

  const phone = normalizePhone(form.get("phone"));
  if (!phone) return { error: "Phone number is not valid. Include the country code for numbers outside India." };

  const params: string[] = [];
  for (let i = 1; i <= template.paramCount; i++) {
    const v = String(form.get(`p${i}`) ?? "").trim();
    if (!v) return { error: `${varLabels(template)[i - 1] ?? `Variable ${i}`} is empty.` };
    params.push(v);
  }
  const mediaUrl = String(form.get("mediaUrl") ?? "").trim();
  if (mediaUrl && !/^https?:\/\//.test(mediaUrl)) return { error: "Media URL must start with http:// or https://" };
  if (needsMedia(template) && !mediaUrl && !template.sampleMediaUrl) {
    return { error: `This template has no ${template.templateType.toLowerCase()} saved in Gupshup. Add a public URL.` };
  }

  const msg = await sendTemplateNow({ app, template, phone, params, mediaUrl, userId: user.id });
  revalidatePath("/messages");
  if (msg.status === "FAILED") return { error: msg.error ?? "Gupshup rejected the message." };
  return { ok: `Sent to +${phone}. Delivery status will update in the message log.`, messageId: msg.id };
}

export async function replyAction(_: SendState, form: FormData): Promise<SendState> {
  const user = await requireUser();
  const contact = await prisma.contact.findUnique({ where: { id: String(form.get("contactId") ?? "") } });
  if (!contact) return { error: "Conversation not found." };
  const app = await getAccessibleApp(user, contact.appId);
  const text = String(form.get("text") ?? "").trim();
  if (!text) return { error: "Type a message." };
  if (text.length > 4096) return { error: "Message is too long (4096 characters max)." };
  if (!windowOpen(contact.lastInboundAt)) {
    return { error: "The 24-hour reply window is closed. Send an approved template instead." };
  }
  const msg = await sendTextNow({ app, contactId: contact.id, phone: contact.phone, text, userId: user.id });
  revalidatePath("/inbox");
  if (msg.status === "FAILED") return { error: msg.error ?? "Gupshup rejected the message." };
  return { ok: "Sent." };
}
