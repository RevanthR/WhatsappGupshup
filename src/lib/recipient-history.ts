import "server-only";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

const CHUNK = 2000;
const NOT_ON_WA: Prisma.MessageWhereInput = {
  OR: [{ error: { contains: "131026" } }, { error: { startsWith: "1013" } }, { error: { contains: "Invalid destination" } }],
};
const OPTED_OUT: Prisma.MessageWhereInput = { error: { contains: "131050" } };

// Numbers that earlier sends from this WhatsApp number showed are pointless to message:
// never reached and failed as "not on WhatsApp", or (for marketing) stopped marketing messages.
export async function knownBadPhones(appId: string, phones: string[], marketing: boolean): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  for (let i = 0; i < phones.length; i += CHUNK) {
    const chunk = phones.slice(i, i + CHUNK);
    const failed = await prisma.message.findMany({
      where: {
        appId,
        direction: "OUTBOUND",
        status: "FAILED",
        phone: { in: chunk },
        OR: [NOT_ON_WA, ...(marketing ? [OPTED_OUT] : [])],
      },
      select: { phone: true, error: true, failedAt: true },
      orderBy: { createdAt: "desc" },
    });
    if (!failed.length) continue;
    const candidates = [...new Set(failed.map((f) => f.phone))];
    const [reached, contacts] = await Promise.all([
      prisma.message.findMany({
        where: { appId, phone: { in: candidates }, OR: [{ status: { in: ["DELIVERED", "READ"] } }, { direction: "INBOUND" }] },
        select: { phone: true },
        distinct: ["phone"],
      }),
      prisma.contact.findMany({ where: { appId, phone: { in: candidates } }, select: { phone: true, lastInboundAt: true } }),
    ]);
    const ok = new Set(reached.map((r) => r.phone));
    const inbound = new Map(contacts.map((c) => [c.phone, c.lastInboundAt]));
    for (const f of failed) {
      if (out.has(f.phone)) continue;
      if (f.error?.includes("131050")) {
        const last = inbound.get(f.phone);
        if (!last || (f.failedAt && last < f.failedAt)) out.set(f.phone, "Skipped: this person stopped marketing messages from you");
      } else if (!ok.has(f.phone)) {
        out.set(f.phone, "Skipped: not on WhatsApp in an earlier send");
      }
    }
  }
  return out;
}

export type DraftWarnings = { recentMarketing: number; recentCapFailures: number };

// For a draft marketing campaign: how many recipients got marketing from this number in the
// last 24 hours, and how many hit Meta's marketing cap in the last 7 days.
export async function draftWarnings(campaignId: string, appId: string): Promise<DraftWarnings> {
  const day = new Date(Date.now() - 24 * 3600 * 1000);
  const week = new Date(Date.now() - 7 * 24 * 3600 * 1000);
  // Columns are UTC timestamps without zone, so compare in UTC whatever the DB session zone is.
  const [row] = await prisma.$queryRaw<{ recent: bigint; capped: bigint }[]>`
    SELECT
      count(*) FILTER (WHERE EXISTS (
        SELECT 1 FROM "Message" o JOIN "Template" t ON t.id = o."templateId"
        WHERE o."appId" = ${appId} AND o.phone = m.phone AND o.direction = 'OUTBOUND'
          AND o."campaignId" IS DISTINCT FROM ${campaignId}
          AND t.category = 'MARKETING' AND o.status IN ('SUBMITTED','ENQUEUED','SENT','DELIVERED','READ')
          AND o."createdAt" > (${day.toISOString()}::timestamptz AT TIME ZONE 'UTC')
      )) AS recent,
      count(*) FILTER (WHERE EXISTS (
        SELECT 1 FROM "Message" o
        WHERE o."appId" = ${appId} AND o.phone = m.phone AND o.status = 'FAILED'
          AND o.error LIKE '%131049%' AND o."createdAt" > (${week.toISOString()}::timestamptz AT TIME ZONE 'UTC')
      )) AS capped
    FROM "Message" m WHERE m."campaignId" = ${campaignId}`;
  return { recentMarketing: Number(row?.recent ?? 0), recentCapFailures: Number(row?.capped ?? 0) };
}
