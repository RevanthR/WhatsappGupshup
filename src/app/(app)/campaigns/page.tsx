import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { appWhere, requireUser } from "@/lib/access";
import { Badge, Empty, fmtDate, PageHeader } from "@/components/ui";

export const metadata = { title: "Campaigns" };

export default async function CampaignsPage() {
  const user = await requireUser();
  const campaigns = await prisma.campaign.findMany({
    where: { app: appWhere(user) },
    include: { app: { select: { name: true } }, template: { select: { elementName: true } }, createdBy: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const ids = campaigns.map((c) => c.id);
  const groups = ids.length
    ? await prisma.message.groupBy({ by: ["campaignId", "status"], where: { campaignId: { in: ids } }, _count: true })
    : [];
  const stats = new Map<string, { done: number; delivered: number; failed: number }>();
  for (const g of groups) {
    const s = stats.get(g.campaignId!) ?? { done: 0, delivered: 0, failed: 0 };
    if (!["QUEUED", "SENDING"].includes(g.status)) s.done += g._count;
    if (["DELIVERED", "READ"].includes(g.status)) s.delivered += g._count;
    if (g.status === "FAILED") s.failed += g._count;
    stats.set(g.campaignId!, s);
  }

  return (
    <>
      <PageHeader title="Campaigns" description="Bulk sends and their progress." actions={<Link href="/bulk" className="btn-primary">New bulk send</Link>} />
      {campaigns.length === 0 ? (
        <Empty title="No campaigns yet">Start one from <Link href="/bulk" className="text-brand-700 hover:underline">Bulk send</Link>.</Empty>
      ) : (
        <>
          {/* Cards on small screens */}
          <ul className="space-y-3 md:hidden">
            {campaigns.map((c) => {
              const s = stats.get(c.id) ?? { done: 0, delivered: 0, failed: 0 };
              return (
                <li key={c.id}>
                  <Link href={`/campaigns/${c.id}`} className="card block p-4">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium text-gray-900">{c.name}</p>
                      <Badge value={c.status} />
                    </div>
                    <p className="mt-1 text-xs text-gray-500">{c.app.name} · {c.template.elementName} · {fmtDate(c.createdAt)}</p>
                    <Progress done={s.done} total={c.total} />
                    <p className="mt-1 text-xs text-gray-600">{s.done}/{c.total} processed · {s.delivered} delivered · {s.failed} failed</p>
                  </Link>
                </li>
              );
            })}
          </ul>
          {/* Table on larger screens */}
          <div className="card hidden overflow-hidden md:block">
            <table className="table">
              <thead>
                <tr><th>Campaign</th><th>App / template</th><th>Status</th><th className="w-48">Progress</th><th>Delivered</th><th>Failed</th><th>Created</th></tr>
              </thead>
              <tbody>
                {campaigns.map((c) => {
                  const s = stats.get(c.id) ?? { done: 0, delivered: 0, failed: 0 };
                  return (
                    <tr key={c.id} className="hover:bg-gray-50">
                      <td><Link href={`/campaigns/${c.id}`} className="font-medium text-gray-900 hover:text-brand-700">{c.name}</Link><p className="text-xs text-gray-500">by {c.createdBy.name}</p></td>
                      <td className="text-gray-700">{c.app.name}<p className="font-mono text-xs text-gray-500">{c.template.elementName}</p></td>
                      <td><Badge value={c.status} /></td>
                      <td><Progress done={s.done} total={c.total} /><p className="mt-1 text-xs text-gray-500">{s.done}/{c.total}</p></td>
                      <td className="tabular-nums">{s.delivered}</td>
                      <td className="tabular-nums">{s.failed}</td>
                      <td className="whitespace-nowrap text-gray-500">{fmtDate(c.createdAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}

function Progress({ done, total }: { done: number; total: number }) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
      <div className="h-full rounded-full bg-brand-500" style={{ width: `${pct}%` }} />
    </div>
  );
}
