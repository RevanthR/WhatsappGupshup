import "server-only";
import { prisma } from "@/lib/prisma";

export type CampaignCounts = {
  total: number;
  queued: number; // not sent yet
  waiting: number; // sent to WhatsApp, no delivery report yet
  delivered: number; // delivered, not read
  read: number;
  failed: number;
};

export function countsFrom(total: number, groups: { status: string; _count: number }[]): CampaignCounts {
  const n = (...s: string[]) => groups.filter((g) => s.includes(g.status)).reduce((a, g) => a + g._count, 0);
  return {
    total,
    queued: n("QUEUED", "SENDING"),
    waiting: n("SUBMITTED", "ENQUEUED", "SENT"),
    delivered: n("DELIVERED"),
    read: n("READ"),
    failed: n("FAILED"),
  };
}

// Counts for many campaigns in one query.
export async function countsFor(campaigns: { id: string; total: number }[]): Promise<Map<string, CampaignCounts>> {
  const out = new Map<string, CampaignCounts>();
  if (!campaigns.length) return out;
  const groups = await prisma.message.groupBy({
    by: ["campaignId", "status"],
    where: { campaignId: { in: campaigns.map((c) => c.id) } },
    _count: true,
  });
  for (const c of campaigns) out.set(c.id, countsFrom(c.total, groups.filter((g) => g.campaignId === c.id)));
  return out;
}

const WINDOW_S = 60;

// Messages handled per second over the last minute, per running campaign.
export async function speedFor(ids: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (!ids.length) return out;
  const since = new Date(Date.now() - WINDOW_S * 1000);
  const rows = await prisma.message.groupBy({
    by: ["campaignId"],
    where: { campaignId: { in: ids }, OR: [{ submittedAt: { gte: since } }, { failedAt: { gte: since } }] },
    _count: true,
  });
  for (const r of rows) out.set(r.campaignId!, r._count / WINDOW_S);
  return out;
}

// "about 3 min left" style text, or null when there is nothing to estimate.
export function etaText(queued: number, perSecond: number): string | null {
  if (!queued || perSecond <= 0) return null;
  const s = Math.ceil(queued / perSecond);
  if (s < 60) return "under a minute left";
  const m = Math.round(s / 60);
  if (m < 60) return `about ${m} min left`;
  const h = Math.floor(m / 60);
  return `about ${h} h ${m % 60} min left`;
}
