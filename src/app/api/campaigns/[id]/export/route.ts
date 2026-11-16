import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { appWhere, getUser } from "@/lib/access";
import { buildResultsWorkbook } from "@/lib/excel";

export const maxDuration = 60;

export async function GET(_: NextRequest, ctx: RouteContext<"/api/campaigns/[id]/export">) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const c = await prisma.campaign.findFirst({ where: { id, app: appWhere(user) }, include: { template: true } });
  if (!c) return NextResponse.json({ error: "not found" }, { status: 404 });
  const rows = await prisma.message.findMany({
    where: { campaignId: id },
    orderBy: { rowNumber: "asc" },
    select: { rowNumber: true, phone: true, params: true, mediaUrl: true, status: true, error: true, submittedAt: true, deliveredAt: true, readAt: true },
  });
  const buf = await buildResultsWorkbook(c.template, rows);
  const safe = c.name.replace(/[^\w.-]+/g, "_").slice(0, 60);
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${safe}-results.xlsx"`,
    },
  });
}
