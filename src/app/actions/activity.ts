"use server";

import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { appWhere, requireUser } from "@/lib/access";
import { getOrigin } from "@/lib/origin";
import { isStalled, kickCampaign, RATE_LIMITED } from "@/lib/worker";
import { countsFor, etaText, speedFor, type CampaignCounts } from "@/lib/campaign-stats";
import { formatPhone } from "@/lib/phone";

export type ActiveCampaign = { id: string; name: string; counts: CampaignCounts; perSec: number; eta: string | null };
export type FinishedCampaign = { id: string; name: string; status: string; counts: CampaignCounts; rateLimited: number };
export type NewReply = { id: string; contactId: string | null; from: string; appName: string; text: string };
export type Activity = {
  now: string;
  running: ActiveCampaign[];
  finished: FinishedCampaign[];
  replies: NewReply[];
};

// One poll for the always-on activity widget: running campaigns, campaigns that
// just finished (from `watch`), and replies that arrived after `repliesSince`.
export async function activityAction(watch: string[], repliesSince: string | null): Promise<Activity | null> {
  const user = await requireUser().catch(() => null);
  if (!user) return null;
  const now = new Date();

  const running = await prisma.campaign.findMany({
    where: { app: appWhere(user), status: "RUNNING" },
    select: { id: true, name: true, total: true, lastTickAt: true, leaseUntil: true, status: true },
    orderBy: { startedAt: "asc" },
    take: 5,
  });
  // Self-heal: restart a stalled chain while someone has the app open.
  const stalled = running.filter((c) => isStalled(c));
  if (stalled.length) {
    const origin = await getOrigin();
    after(() => Promise.all(stalled.map((c) => kickCampaign(origin, c.id))));
  }

  const runningIds = new Set(running.map((c) => c.id));
  const doneIds = watch.filter((id) => !runningIds.has(id)).slice(0, 5);
  const finished = doneIds.length
    ? await prisma.campaign.findMany({
        where: { id: { in: doneIds }, app: appWhere(user), status: { in: ["COMPLETED", "CANCELLED", "PAUSED"] } },
        select: { id: true, name: true, total: true, status: true },
      })
    : [];

  const [counts, speed, rateLimited] = await Promise.all([
    countsFor([...running, ...finished]),
    speedFor(running.map((c) => c.id)),
    finished.length
      ? prisma.message.groupBy({ by: ["campaignId"], where: { AND: [{ campaignId: { in: finished.map((f) => f.id) }, status: "FAILED" }, RATE_LIMITED] }, _count: true })
      : Promise.resolve([]),
  ]);

  const since = repliesSince ? new Date(repliesSince) : null;
  const replies =
    since && !Number.isNaN(since.getTime())
      ? await prisma.message.findMany({
          where: { app: appWhere(user), direction: "INBOUND", createdAt: { gt: since } },
          select: { id: true, contactId: true, phone: true, text: true, type: true, app: { select: { name: true } }, contact: { select: { name: true } } },
          orderBy: { createdAt: "desc" },
          take: 3,
        })
      : [];

  return {
    now: now.toISOString(),
    running: running.map((c) => {
      const k = counts.get(c.id)!;
      const perSec = speed.get(c.id) ?? 0;
      return { id: c.id, name: c.name, counts: k, perSec, eta: etaText(k.queued, perSec) };
    }),
    finished: finished.map((f) => ({
      id: f.id,
      name: f.name,
      status: f.status,
      counts: counts.get(f.id)!,
      rateLimited: rateLimited.find((r) => r.campaignId === f.id)?._count ?? 0,
    })),
    replies: replies.map((m) => ({
      id: m.id,
      contactId: m.contactId,
      from: m.contact?.name || formatPhone(m.phone),
      appName: m.app.name,
      text: (m.text || `[${m.type ?? "message"}]`).slice(0, 140),
    })),
  };
}
