import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { appWhere, requireUser } from "@/lib/access";
import { Badge, Card, Empty, fmtDate, PageHeader } from "@/components/ui";
import { DeliveryStats } from "@/components/delivery-stats";
import { daysAgo } from "@/lib/send";
import { BulkForm } from "./form";

export const metadata = { title: "Bulk send" };

export default async function BulkPage({ searchParams }: PageProps<"/bulk">) {
  const sp = await searchParams;
  const user = await requireUser();
  const apps = await prisma.app.findMany({
    where: { ...appWhere(user), active: true },
    select: {
      id: true,
      name: true,
      account: { select: { name: true } },
      templates: {
        where: { status: "APPROVED" },
        select: { id: true, elementName: true, body: true, header: true, footer: true, templateType: true, category: true, paramCount: true, languageCode: true, sampleMediaUrl: true },
        orderBy: { elementName: "asc" },
      },
    },
    orderBy: { name: "asc" },
  });
  const since = daysAgo(30);
  const recent = await prisma.campaign.findMany({
    where: { app: appWhere(user) },
    select: { id: true, name: true, status: true, total: true, createdAt: true, app: { select: { name: true } }, template: { select: { elementName: true, templateType: true } } },
    orderBy: { createdAt: "desc" },
    take: 5,
  });
  const groups = recent.length
    ? await prisma.message.groupBy({ by: ["campaignId", "status"], where: { campaignId: { in: recent.map((c) => c.id) } }, _count: true })
    : [];
  const count = (id: string, ...st: string[]) => groups.filter((g) => g.campaignId === id && st.includes(g.status)).reduce((a, g) => a + g._count, 0);

  return (
    <>
      <PageHeader title="Bulk send" description="Upload an Excel file to send one template to many numbers." />
      {recent.length ? (
        <>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">Bulk sends, last 30 days</p>
          <DeliveryStats
            where={{ app: appWhere(user), campaignId: { not: null }, createdAt: { gte: since } }}
            link={(k) => `/messages?dir=bulk&range=30d${k ? `&status=${k}` : ""}`}
          />
        </>
      ) : null}
      {apps.length === 0 ? (
        <Empty title="No WhatsApp numbers available">
          <Link href="/numbers/new" className="text-brand-700 hover:underline">Connect a WhatsApp number</Link> first, or ask your admin for access.
        </Empty>
      ) : (
        <BulkForm apps={apps} initialAppId={typeof sp.app === "string" ? sp.app : undefined}
          initialTemplateId={typeof sp.template === "string" ? sp.template : undefined} />
      )}
      {recent.length ? (
        <div className="mt-6">
          <Card title="Recent campaigns" actions={<Link href="/campaigns" className="text-sm text-brand-700 hover:underline">All campaigns</Link>}>
            <ul className="divide-y divide-gray-100">
              {recent.map((c) => {
                const delivered = count(c.id, "DELIVERED", "READ");
                const read = count(c.id, "READ");
                const failed = count(c.id, "FAILED");
                const done = c.total - count(c.id, "QUEUED", "SENDING");
                const rate = done ? Math.round((delivered / done) * 100) : 0;
                return (
                  <li key={c.id}>
                    <Link href={`/campaigns/${c.id}`} className="-mx-2 flex flex-col gap-2 rounded-lg px-2 py-3 hover:bg-gray-50 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-gray-900">{c.name}</p>
                        <p className="text-xs text-gray-500">{c.app.name} · <span className="font-mono">{c.template.elementName}</span> · {fmtDate(c.createdAt)}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-3 text-xs text-gray-600">
                        <span className="tabular-nums">{c.total.toLocaleString("en-IN")} sent</span>
                        <span className="tabular-nums text-emerald-700">{delivered.toLocaleString("en-IN")} delivered ({rate}%)</span>
                        <span className="tabular-nums text-brand-700">{read.toLocaleString("en-IN")} read</span>
                        <span className="tabular-nums text-red-700">{failed.toLocaleString("en-IN")} failed</span>
                        <Badge value={c.status} />
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </Card>
        </div>
      ) : null}
    </>
  );
}
