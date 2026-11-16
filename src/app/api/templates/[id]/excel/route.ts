import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { appWhere, getUser } from "@/lib/access";
import { buildTemplateWorkbook } from "@/lib/excel";

export async function GET(_: NextRequest, ctx: RouteContext<"/api/templates/[id]/excel">) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const t = await prisma.template.findFirst({ where: { id, app: appWhere(user) } });
  if (!t) return NextResponse.json({ error: "not found" }, { status: 404 });
  const buf = await buildTemplateWorkbook(t);
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${t.elementName}-recipients.xlsx"`,
    },
  });
}
