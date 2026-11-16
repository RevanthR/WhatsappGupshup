// Local end-to-end check against the mock Gupshup server (scratch only).
// Run: npx tsx --conditions=react-server scripts/e2e-local.ts
import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { encrypt, randomToken } from "@/lib/crypto";
import { listTemplates } from "@/lib/gupshup";
import { kickCampaign } from "@/lib/worker";

const ORIGIN = process.env.E2E_ORIGIN || "http://localhost:3000";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const admin = await prisma.user.findFirstOrThrow({ where: { role: "SUPER_ADMIN" } });
  const account = await prisma.gupshupAccount.create({ data: { name: "E2E Account", ownerId: admin.id, access: { create: { userId: admin.id } } } });
  const app = await prisma.app.create({
    data: { accountId: account.id, name: "E2E App", gupshupAppName: "E2EApp", sourceNumber: "919000000000", apiKeyEnc: encrypt("test-key-1234"), apiKeyLast4: "1234", webhookToken: randomToken(32) },
  });
  const remote = await listTemplates("test-key-1234", "E2EApp");
  console.log("templates from mock:", remote.map((t) => `${t.elementName}:${t.status}:${t.paramCount}`).join(", "));
  const t = remote[0];
  const tpl = await prisma.template.create({
    data: { appId: app.id, gupshupId: t.id, elementName: t.elementName, languageCode: t.languageCode, status: t.status, templateType: t.templateType, body: t.body, footer: t.footer, paramCount: t.paramCount },
  });

  const N = Number(process.env.E2E_N || 260);
  const campaign = await prisma.campaign.create({
    data: { name: "E2E bulk", appId: app.id, templateId: tpl.id, createdById: admin.id, status: "RUNNING", total: N, startedAt: new Date(), lastTickAt: new Date() },
  });
  await prisma.message.createMany({
    data: Array.from({ length: N }, (_, i) => ({
      appId: app.id, campaignId: campaign.id, templateId: tpl.id, sentById: admin.id, direction: "OUTBOUND" as const,
      phone: i === 5 ? "919999999999" : String(918000000000 + i), status: "QUEUED" as const, params: [`Name${i}`, `ORD${i}`], rowNumber: i + 2,
    })),
  });

  const t0 = Date.now();
  console.log("kick:", await kickCampaign(ORIGIN, campaign.id));
  for (;;) {
    await sleep(1000);
    const c = await prisma.campaign.findUniqueOrThrow({ where: { id: campaign.id } });
    const g = await prisma.message.groupBy({ by: ["status"], where: { campaignId: campaign.id }, _count: true });
    console.log(`${((Date.now() - t0) / 1000).toFixed(0)}s`, c.status, g.map((x) => `${x.status}=${x._count}`).join(" "));
    if (c.status !== "RUNNING" || Date.now() - t0 > 180_000) break;
  }
  const failed = await prisma.message.findFirst({ where: { campaignId: campaign.id, status: "FAILED" } });
  console.log("failed row:", failed?.phone, failed?.error);

  // Webhook: v2 status events for one message
  const m = await prisma.message.findFirstOrThrow({ where: { campaignId: campaign.id, status: "SUBMITTED" } });
  const hook = `${ORIGIN}/api/webhooks/gupshup/${app.webhookToken}`;
  const post = (b: unknown) => fetch(hook, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) }).then((r) => r.status);
  console.log("empty post:", await fetch(hook, { method: "POST" }).then((r) => r.status));
  console.log("bad token:", await fetch(`${ORIGIN}/api/webhooks/gupshup/nope`, { method: "POST", body: "{}" }).then((r) => r.status));
  await post({ app: "E2EApp", timestamp: Date.now(), version: 2, type: "message-event", payload: { id: m.gupshupMessageId, type: "enqueued", destination: m.phone, payload: { whatsappMessageId: "wamid.X1", type: "session" } } });
  await post({ app: "E2EApp", timestamp: Date.now(), version: 2, type: "message-event", payload: { id: "wamid.X1", gsId: m.gupshupMessageId, type: "read", destination: m.phone, payload: { ts: 1 } } });
  await post({ app: "E2EApp", timestamp: Date.now(), version: 2, type: "message-event", payload: { id: "wamid.X1", gsId: m.gupshupMessageId, type: "delivered", destination: m.phone, payload: { ts: 1 } } });
  const after = await prisma.message.findUniqueOrThrow({ where: { id: m.id } });
  console.log("status after enqueued, read, delivered (out of order):", after.status, "wamid:", after.whatsappMessageId, "readAt set:", !!after.readAt);

  // Meta format status: failed for another message
  const m2 = await prisma.message.findFirstOrThrow({ where: { campaignId: campaign.id, status: "SUBMITTED" } });
  await post({ object: "whatsapp_business_account", entry: [{ id: "1", changes: [{ field: "messages", value: { statuses: [{ id: "wamid.Y2", gs_id: m2.gupshupMessageId, status: "failed", timestamp: "1700000000", recipient_id: m2.phone, errors: [{ code: 131026, title: "Message undeliverable" }] }] } }] }] });
  const m2a = await prisma.message.findUniqueOrThrow({ where: { id: m2.id } });
  console.log("meta failed:", m2a.status, m2a.error);

  // Inbound v2 + Meta, plus duplicate delivery
  await post({ app: "E2EApp", timestamp: Date.now(), version: 2, type: "message", payload: { id: "wamid.IN1", source: "918000000001", type: "text", payload: { text: "Where is my order?" }, sender: { phone: "918000000001", name: "Asha", country_code: "91", dial_code: "8000000001" } } });
  await post({ app: "E2EApp", timestamp: Date.now(), version: 2, type: "message", payload: { id: "wamid.IN1", source: "918000000001", type: "text", payload: { text: "Where is my order?" }, sender: { phone: "918000000001", name: "Asha" } } });
  await post({ object: "whatsapp_business_account", entry: [{ changes: [{ value: { contacts: [{ wa_id: "918000000002", profile: { name: "Ravi" } }], messages: [{ from: "918000000002", id: "wamid.IN2", timestamp: String(Math.floor(Date.now() / 1000)), type: "text", text: { body: "Thanks!" } }] } }] }] });
  const contacts = await prisma.contact.findMany({ where: { appId: app.id, lastInboundAt: { not: null } } });
  console.log("inbox contacts:", contacts.map((c) => `${c.name}:${c.phone}:unread=${c.unreadCount}:${c.lastPreview}`).join(" | "));
  const inbound = await prisma.message.count({ where: { appId: app.id, direction: "INBOUND" } });
  console.log("inbound stored (expect 2):", inbound);

  // Cron sweep auth
  console.log("cron no auth:", await fetch(`${ORIGIN}/api/cron/sweep`).then((r) => r.status));
  console.log("cron auth:", await fetch(`${ORIGIN}/api/cron/sweep`, { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } }).then((r) => r.json()));
  console.log("worker bad sig:", await fetch(`${ORIGIN}/api/worker/campaigns/${campaign.id}`, { method: "POST", headers: { "x-worker-signature": "x" } }).then((r) => r.status));
}

main().finally(() => prisma.$disconnect());
