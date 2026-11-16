import { after, NextResponse, type NextRequest } from "next/server";
import { kickCampaign, runCampaign, verifyWorkerSignature } from "@/lib/worker";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, ctx: RouteContext<"/api/worker/campaigns/[id]">) {
  const { id } = await ctx.params;
  if (!verifyWorkerSignature(id, req.headers.get("x-worker-signature"))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const origin = req.nextUrl.origin;
  // Reply now, work after the response, then hand off to a fresh invocation.
  after(async () => {
    try {
      const result = await runCampaign(id);
      if (result === "more") await kickCampaign(origin, id);
    } catch (e) {
      console.error("worker run failed", id, e);
    }
  });
  return NextResponse.json({ accepted: true }, { status: 202 });
}
