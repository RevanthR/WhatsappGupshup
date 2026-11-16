import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { isStalled, kickCampaign } from "@/lib/worker";

export const dynamic = "force-dynamic";

// Safety net (Vercel cron): restart any running campaign whose chain broke.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const running = await prisma.campaign.findMany({
    where: { status: "RUNNING" },
    select: { id: true, status: true, lastTickAt: true, leaseUntil: true },
  });
  const stalled = running.filter(isStalled);
  for (const c of stalled) await kickCampaign(req.nextUrl.origin, c.id);
  return NextResponse.json({ running: running.length, restarted: stalled.length });
}
