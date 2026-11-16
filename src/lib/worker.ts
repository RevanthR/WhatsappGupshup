import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { credsFor, mediaHeader } from "@/lib/send";
import { renderPreviewText } from "@/lib/template-vars";
import { sendTemplate } from "@/lib/gupshup";
import type { Prisma } from "@/generated/prisma/client";

// Bulk sending runs in short chained invocations ("the app calls itself").
// Each run holds a lease on the campaign, sends for up to RUN_BUDGET_MS,
// then releases the lease and triggers the next run if work remains.

const RUN_BUDGET_MS = Number(process.env.WORKER_RUN_BUDGET_MS) || 40_000;
const LEASE_MS = 70_000;
const BATCH = 25;
const CONCURRENCY = 8;
const MAX_ATTEMPTS = 3;
export const STALL_MS = 2 * 60 * 1000;

function secret(): string {
  const s = process.env.WORKER_SECRET || process.env.AUTH_SECRET;
  if (!s) throw new Error("WORKER_SECRET or AUTH_SECRET must be set");
  return s;
}

export function workerSignature(campaignId: string): string {
  return createHmac("sha256", secret()).update(`campaign:${campaignId}`).digest("hex");
}

export function verifyWorkerSignature(campaignId: string, sig: string | null): boolean {
  if (!sig) return false;
  const expected = Buffer.from(workerSignature(campaignId));
  const got = Buffer.from(sig);
  return expected.length === got.length && timingSafeEqual(expected, got);
}

// Fire the worker endpoint. It replies at once and does the work after responding.
export async function kickCampaign(origin: string, campaignId: string): Promise<boolean> {
  try {
    const res = await fetch(`${origin}/api/worker/campaigns/${campaignId}`, {
      method: "POST",
      headers: { "x-worker-signature": workerSignature(campaignId) },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    return res.ok;
  } catch (e) {
    console.error("kickCampaign failed", campaignId, e);
    return false;
  }
}

async function acquireLease(campaignId: string): Promise<boolean> {
  const until = new Date(Date.now() + LEASE_MS);
  const res = await prisma.campaign.updateMany({
    where: {
      id: campaignId,
      status: "RUNNING",
      OR: [{ leaseUntil: null }, { leaseUntil: { lt: new Date() } }],
    },
    data: { leaseUntil: until, lastTickAt: new Date() },
  });
  return res.count === 1;
}

type Claimed = { id: string; phone: string; params: Prisma.JsonValue; mediaUrl: string | null; attempts: number };

async function claimBatch(campaignId: string): Promise<Claimed[]> {
  return prisma.$queryRaw<Claimed[]>`
    UPDATE "Message" SET status = 'SENDING', attempts = attempts + 1, "updatedAt" = now()
    WHERE id IN (
      SELECT id FROM "Message"
      WHERE "campaignId" = ${campaignId} AND status = 'QUEUED'
      ORDER BY "rowNumber" ASC NULLS LAST, "createdAt" ASC
      LIMIT ${BATCH}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING id, phone, params, "mediaUrl", attempts`;
}

async function pool<T>(items: T[], n: number, fn: (item: T) => Promise<void>) {
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (i < items.length) await fn(items[i++]);
    }),
  );
}

// Returns "more" if queued work is left and the chain should continue.
export async function runCampaign(campaignId: string): Promise<"more" | "done" | "busy" | "stopped"> {
  if (!(await acquireLease(campaignId))) {
    const c = await prisma.campaign.findUnique({ where: { id: campaignId }, select: { status: true } });
    return c?.status === "RUNNING" ? "busy" : "stopped";
  }
  const started = Date.now();
  try {
    const campaign = await prisma.campaign.findUniqueOrThrow({
      where: { id: campaignId },
      include: { app: true, template: true },
    });
    const creds = credsFor(campaign.app);

    // Anything stuck in SENDING from a crashed run has an unknown outcome.
    // Mark it failed rather than risk sending the same message twice.
    await prisma.message.updateMany({
      where: { campaignId, status: "SENDING", updatedAt: { lt: new Date(Date.now() - STALL_MS) } },
      data: { status: "FAILED", error: "Interrupted while sending. Status unknown, not retried.", failedAt: new Date() },
    });

    while (Date.now() - started < RUN_BUDGET_MS) {
      const current = await prisma.campaign.findUnique({ where: { id: campaignId }, select: { status: true } });
      if (current?.status !== "RUNNING") return "stopped";

      const batch = await claimBatch(campaignId);
      if (batch.length === 0) break;

      await pool(batch, CONCURRENCY, async (m) => {
        const params = Array.isArray(m.params) ? (m.params as string[]) : [];
        const res = await sendTemplate(
          creds,
          m.phone,
          campaign.template.gupshupId,
          params,
          mediaHeader(campaign.template, m.mediaUrl),
        );
        // Each message is recorded on its own so one bad write never stalls the batch.
        try {
          if (res.ok) {
            await prisma.message.update({
              where: { id: m.id },
              data: { status: "SUBMITTED", gupshupMessageId: res.messageId, submittedAt: new Date(), error: null },
            });
          } else if (res.retryable && m.attempts < MAX_ATTEMPTS) {
            await prisma.message.update({ where: { id: m.id }, data: { status: "QUEUED", error: res.error } });
          } else {
            await prisma.message.update({
              where: { id: m.id },
              data: { status: "FAILED", error: res.error, failedAt: new Date() },
            });
          }
        } catch (e) {
          console.error("worker: could not record result", m.id, e);
          await prisma.message
            .update({
              where: { id: m.id },
              data: res.ok
                ? { status: "SUBMITTED", submittedAt: new Date(), error: `Sent, but id ${res.messageId} could not be stored` }
                : { status: "FAILED", error: res.error, failedAt: new Date() },
            })
            .catch(() => undefined);
        }
      });

      // Update contacts for the inbox in one pass per batch.
      const now = new Date();
      await Promise.allSettled(
        batch.map((m) =>
          prisma.contact
            .upsert({
              where: { appId_phone: { appId: campaign.appId, phone: m.phone } },
              create: {
                appId: campaign.appId,
                phone: m.phone,
                lastMessageAt: now,
                lastPreview: renderPreviewText(campaign.template, (m.params as string[]) ?? []).slice(0, 200),
              },
              update: {
                lastMessageAt: now,
                lastPreview: renderPreviewText(campaign.template, (m.params as string[]) ?? []).slice(0, 200),
              },
              select: { id: true },
            })
            .then((c) => prisma.message.update({ where: { id: m.id }, data: { contactId: c.id } })),
        ),
      );

      await prisma.campaign.update({
        where: { id: campaignId },
        data: { lastTickAt: new Date(), leaseUntil: new Date(Date.now() + LEASE_MS) },
      });
    }

    const remaining = await prisma.message.count({ where: { campaignId, status: { in: ["QUEUED", "SENDING"] } } });
    if (remaining === 0) {
      await prisma.campaign.updateMany({
        where: { id: campaignId, status: "RUNNING" },
        data: { status: "COMPLETED", completedAt: new Date() },
      });
      return "done";
    }
    return "more";
  } finally {
    await prisma.campaign.update({ where: { id: campaignId }, data: { leaseUntil: null, lastTickAt: new Date() } });
  }
}

export function isStalled(c: { status: string; lastTickAt: Date | null; leaseUntil: Date | null }): boolean {
  if (c.status !== "RUNNING") return false;
  const now = Date.now();
  if (c.leaseUntil && c.leaseUntil.getTime() > now) return false;
  return !c.lastTickAt || now - c.lastTickAt.getTime() > STALL_MS;
}
