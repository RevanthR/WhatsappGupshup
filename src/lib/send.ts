import "server-only";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/crypto";
import { sendTemplate, sendText, type GupshupCreds, type MediaHeader } from "@/lib/gupshup";
import type { App, Template } from "@/generated/prisma/client";
import { renderPreviewText } from "@/lib/template-vars";

export function credsFor(app: Pick<App, "apiKeyEnc" | "gupshupAppName" | "sourceNumber">): GupshupCreds {
  return { apiKey: decrypt(app.apiKeyEnc), appName: app.gupshupAppName, source: app.sourceNumber };
}

export const MEDIA_TYPES = ["IMAGE", "VIDEO", "DOCUMENT"] as const;
export const needsMedia = (t: Pick<Template, "templateType">) =>
  (MEDIA_TYPES as readonly string[]).includes(t.templateType);

export function mediaHeader(t: Pick<Template, "templateType">, url?: string | null, filename?: string | null): MediaHeader | undefined {
  if (!needsMedia(t) || !url) return undefined;
  return { type: t.templateType.toLowerCase() as MediaHeader["type"], url, filename: filename ?? undefined };
}


export async function upsertContact(appId: string, phone: string, at: Date, preview: string, inbound = false, name?: string) {
  return prisma.contact.upsert({
    where: { appId_phone: { appId, phone } },
    create: {
      appId,
      phone,
      name: name ?? null,
      lastMessageAt: at,
      lastPreview: preview.slice(0, 200),
      lastInboundAt: inbound ? at : null,
      unreadCount: inbound ? 1 : 0,
    },
    update: {
      lastMessageAt: at,
      lastPreview: preview.slice(0, 200),
      ...(name ? { name } : {}),
      ...(inbound ? { lastInboundAt: at, unreadCount: { increment: 1 } } : {}),
    },
  });
}

// Single template message, sent now. Returns the stored message.
export async function sendTemplateNow(opts: {
  app: App;
  template: Template;
  phone: string;
  params: string[];
  mediaUrl?: string | null;
  userId: string;
}) {
  const { app, template, phone, params, mediaUrl, userId } = opts;
  const now = new Date();
  const preview = renderPreviewText(template, params);
  const contact = await upsertContact(app.id, phone, now, preview);
  const msg = await prisma.message.create({
    data: {
      appId: app.id,
      contactId: contact.id,
      templateId: template.id,
      sentById: userId,
      direction: "OUTBOUND",
      phone,
      status: "SENDING",
      type: "template",
      params,
      mediaUrl: mediaUrl || null,
      text: preview,
      attempts: 1,
    },
  });
  const res = await sendTemplate(credsFor(app), phone, template.gupshupId, params, mediaHeader(template, mediaUrl));
  return prisma.message.update({
    where: { id: msg.id },
    data: res.ok
      ? { status: "SUBMITTED", gupshupMessageId: res.messageId, submittedAt: new Date() }
      : { status: "FAILED", error: res.error, failedAt: new Date() },
  });
}

// Free-text reply, only valid inside the 24h customer service window.
export async function sendTextNow(opts: { app: App; contactId: string; phone: string; text: string; userId: string }) {
  const { app, contactId, phone, text, userId } = opts;
  const now = new Date();
  await upsertContact(app.id, phone, now, text);
  const msg = await prisma.message.create({
    data: {
      appId: app.id,
      contactId,
      sentById: userId,
      direction: "OUTBOUND",
      phone,
      status: "SENDING",
      type: "text",
      text,
      attempts: 1,
    },
  });
  const res = await sendText(credsFor(app), phone, text);
  return prisma.message.update({
    where: { id: msg.id },
    data: res.ok
      ? { status: "SUBMITTED", gupshupMessageId: res.messageId, submittedAt: new Date() }
      : { status: "FAILED", error: res.error, failedAt: new Date() },
  });
}

export const WINDOW_MS = 24 * 60 * 60 * 1000;
export const windowOpen = (lastInboundAt: Date | null | undefined) =>
  !!lastInboundAt && Date.now() - lastInboundAt.getTime() < WINDOW_MS;

export const windowHoursLeft = (lastInboundAt: Date | null | undefined) =>
  lastInboundAt ? Math.max(0, Math.floor((lastInboundAt.getTime() + WINDOW_MS - Date.now()) / 3_600_000)) : 0;

export const daysAgo = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000);
