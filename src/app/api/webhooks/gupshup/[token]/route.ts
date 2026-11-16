import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { upsertContact } from "@/lib/send";
import { normalizePhone } from "@/lib/phone";
import type { MessageStatus } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

// Gupshup posts here for delivery events and incoming messages. Supports both the
// Gupshup v2 payload ({type, payload}) and the Meta format ({entry[].changes[]}).
// Always replies 200 quickly so Gupshup does not disable the callback.

const RANK: Record<string, number> = {
  QUEUED: 0, SENDING: 1, SUBMITTED: 2, ENQUEUED: 3, SENT: 4, DELIVERED: 5, READ: 6, FAILED: 7, RECEIVED: 0,
};

const EVENT_MAP: Record<string, MessageStatus> = {
  enqueued: "ENQUEUED",
  sent: "SENT",
  delivered: "DELIVERED",
  read: "READ",
  failed: "FAILED",
};

type Json = Record<string, unknown>;
const obj = (v: unknown): Json => (v && typeof v === "object" ? (v as Json) : {});
const str = (v: unknown) => (typeof v === "string" ? v : v == null ? undefined : String(v));

export async function GET() {
  return NextResponse.json({ ok: true });
}

export async function POST(req: NextRequest, ctx: RouteContext<"/api/webhooks/gupshup/[token]">) {
  const { token } = await ctx.params;
  const app = await prisma.app.findUnique({ where: { webhookToken: token } });
  if (!app) return NextResponse.json({ ok: false }, { status: 404 });

  let body: Json = {};
  try {
    body = obj(await req.json());
  } catch {
    // Gupshup sends an empty POST when the URL is first saved.
    return NextResponse.json({ ok: true });
  }

  await prisma.app.update({ where: { id: app.id }, data: { lastWebhookAt: new Date() } });

  try {
    if (Array.isArray(body.entry)) await handleMeta(app.id, body);
    else await handleV2(app.id, body);
  } catch (e) {
    console.error("webhook handling failed", app.id, e, JSON.stringify(body).slice(0, 1000));
  }
  return NextResponse.json({ ok: true });
}

async function applyStatus(appId: string, opts: {
  ids: (string | undefined)[];
  whatsappId?: string;
  status: MessageStatus;
  at: Date;
  error?: string;
}) {
  const ids = opts.ids.filter(Boolean) as string[];
  const or = [
    ...ids.map((id) => ({ gupshupMessageId: id })),
    ...ids.map((id) => ({ whatsappMessageId: id })),
    ...(opts.whatsappId ? [{ whatsappMessageId: opts.whatsappId }] : []),
  ];
  if (or.length === 0) return;
  // Scoped to the app that owns this webhook. Prefer the Gupshup id match.
  const msg =
    (ids.length ? await prisma.message.findFirst({ where: { appId, gupshupMessageId: { in: ids } } }) : null) ??
    (await prisma.message.findFirst({ where: { appId, direction: "OUTBOUND", OR: or } }));
  if (!msg) return;
  // Events can arrive out of order. Never move a message backwards (e.g. read -> delivered).
  if (RANK[opts.status] <= RANK[msg.status] && opts.status !== "FAILED") return;
  if (msg.status === "READ" && opts.status === "FAILED") return;
  const at = opts.at;
  await prisma.message.update({
    where: { id: msg.id },
    data: {
      status: opts.status,
      whatsappMessageId: opts.whatsappId ?? msg.whatsappMessageId,
      ...(opts.status === "SENT" ? { sentAt: at } : {}),
      ...(opts.status === "DELIVERED" ? { deliveredAt: at, sentAt: msg.sentAt ?? at } : {}),
      ...(opts.status === "READ" ? { readAt: at, deliveredAt: msg.deliveredAt ?? at, sentAt: msg.sentAt ?? at } : {}),
      ...(opts.status === "FAILED" ? { failedAt: at, error: opts.error ?? msg.error } : {}),
    },
  });
}

async function storeInbound(appId: string, opts: {
  from: string;
  name?: string;
  type: string;
  text?: string;
  mediaUrl?: string;
  providerId?: string;
  at: Date;
}) {
  const phone = normalizePhone(opts.from) ?? opts.from.replace(/\D/g, "");
  if (!phone) return;
  if (opts.providerId) {
    const dup = await prisma.message.findFirst({ where: { appId, whatsappMessageId: opts.providerId, direction: "INBOUND" } });
    if (dup) return;
  }
  const preview = opts.text || `[${opts.type}]`;
  const contact = await upsertContact(appId, phone, opts.at, preview, true, opts.name);
  await prisma.message.create({
    data: {
      appId,
      contactId: contact.id,
      direction: "INBOUND",
      phone,
      status: "RECEIVED",
      type: opts.type,
      text: opts.text ?? null,
      mediaUrl: opts.mediaUrl ?? null,
      whatsappMessageId: opts.providerId ?? null,
      createdAt: opts.at,
    },
  });
}

function inboundText(type: string, p: Json): { text?: string; mediaUrl?: string } {
  switch (type) {
    case "text":
      return { text: str(p.text) };
    case "image":
    case "video":
    case "file":
    case "audio":
    case "sticker":
      return { text: str(p.caption) || str(p.name), mediaUrl: str(p.url) };
    case "location":
      return { text: `Location: ${str(p.latitude)}, ${str(p.longitude)}` };
    case "button_reply":
    case "list_reply":
    case "quick_reply":
      return { text: str(p.title) || str(p.text) || str(p.reply) };
    default:
      return { text: str(p.text) || str(p.title) };
  }
}

async function handleV2(appId: string, body: Json) {
  const type = str(body.type);
  const payload = obj(body.payload);
  const at = body.timestamp ? new Date(Number(body.timestamp)) : new Date();

  if (type === "message-event") {
    const ev = str(payload.type) ?? "";
    const status = EVENT_MAP[ev];
    if (!status) return;
    const inner = obj(payload.payload);
    await applyStatus(appId, {
      ids: [str(payload.gsId), str(payload.id)],
      whatsappId: str(inner.whatsappMessageId) ?? (ev !== "enqueued" ? str(payload.id) : undefined),
      status,
      at,
      error: status === "FAILED" ? [str(inner.code), str(inner.reason)].filter(Boolean).join(": ") : undefined,
    });
    return;
  }

  if (type === "message") {
    const msgType = str(payload.type) ?? "text";
    const sender = obj(payload.sender);
    const content = inboundText(msgType, obj(payload.payload));
    await storeInbound(appId, {
      from: str(sender.phone) ?? str(payload.source) ?? "",
      name: str(sender.name),
      type: msgType,
      ...content,
      providerId: str(payload.id),
      at,
    });
  }
}

async function handleMeta(appId: string, body: Json) {
  for (const entry of body.entry as unknown[]) {
    for (const change of (obj(entry).changes as unknown[]) ?? []) {
      const value = obj(obj(change).value);
      for (const s of (value.statuses as unknown[]) ?? []) {
        const st = obj(s);
        const status = EVENT_MAP[str(st.status) ?? ""];
        if (!status) continue;
        const errors = (st.errors as unknown[]) ?? [];
        const err = errors.length ? obj(errors[0]) : {};
        await applyStatus(appId, {
          ids: [str(st.gs_id), str(st.meta_msg_id), str(st.id)],
          whatsappId: str(st.id),
          status,
          at: st.timestamp ? new Date(Number(st.timestamp) * 1000) : new Date(),
          error: errors.length ? [str(err.code), str(err.title) ?? str(err.message)].filter(Boolean).join(": ") : undefined,
        });
      }
      const contacts = (value.contacts as unknown[]) ?? [];
      for (const m of (value.messages as unknown[]) ?? []) {
        const msg = obj(m);
        const msgType = str(msg.type) ?? "text";
        const part = obj(msg[msgType]);
        const contact = obj(contacts.find((c) => str(obj(c).wa_id) === str(msg.from)));
        let text: string | undefined;
        if (msgType === "text") text = str(part.body);
        else if (msgType === "button") text = str(part.text);
        else if (msgType === "interactive") text = str(obj(part.button_reply).title) ?? str(obj(part.list_reply).title);
        else if (msgType === "location") text = `Location: ${str(part.latitude)}, ${str(part.longitude)}`;
        else text = str(part.caption) ?? str(part.filename);
        await storeInbound(appId, {
          from: str(msg.from) ?? "",
          name: str(obj(contact.profile).name),
          type: msgType,
          text,
          mediaUrl: str(part.url) ?? str(part.link),
          providerId: str(msg.id),
          at: msg.timestamp ? new Date(Number(msg.timestamp) * 1000) : new Date(),
        });
      }
    }
  }
}
