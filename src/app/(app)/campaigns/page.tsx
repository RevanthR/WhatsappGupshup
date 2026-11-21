import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { appWhere, requireUser } from "@/lib/access";
import { Badge, Empty, fmtDate, PageHeader } from "@/components/ui";
import { DeliveryStats } from "@/components/delivery-stats";
import { CampaignBar, processedPct } from "@/components/campaign-bar";
import { AutoRefresh } from "@/components/auto-refresh";
import { countsFor, etaText, speedFor, type CampaignCounts } from "@/lib/campaign-stats";
import { daysAgo } from "@/lib/send";

export const metadata = { title: "Bulk send" };

const EMPTY: CampaignCounts = { total: 0, queued: 0, waiting: 0, delivered: 0, read: 0, failed: 0 };

export default async function CampaignsPage() {
  const user = await requireUser();
  const campaigns = await prisma.campaign.findMany({
    where: { app: appWhere(user) },
    include: { app: { select: { name: true } }, template: { select: { elementName: true } }, createdBy: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const running = campaigns.filter((c) => c.status === "RUNNING").map((c) => c.id);
  const [stats, speed] = await Promise.all([countsFor(campaigns), speedFor(running)]);

  const live = (id: string, queued: number) => {
    const s = speed.get(id) ?? 0;
    const eta = etaText(queued, s);
    return s > 0 ? `${s < 1 ? s.toFixed(1) : Math.round(s)}/sec${eta ? ` · ${eta}` : ""}` : "Starting up";
  };

  return (
    <>
      <AutoRefresh active={running.length > 0} />
      <PageHeader title="Bulk send" description="Send one template to many numbers from an Excel file. Each upload is a campaign." actions={<Link href="/bulk" className="btn-primary">+ New bulk send</Link>} />
      {campaigns.length ? (
        <>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">Last 30 days</p>
          <DeliveryStats
            where={{ app: appWhere(user), campaignId: { not: null }, createdAt: { gte: daysAgo(30) } }}
            link={(k) => `/messages?dir=bulk&range=30d${k ? `&status=${k}` : ""}`}
          />
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">Campaigns</p>
        </>
      ) : null}
      {campaigns.length === 0 ? (
        <Empty title="No bulk sends yet"><Link href="/bulk" className="text-brand-700 hover:underline">Start your first bulk send</Link>. Download the Excel for a template, fill in numbers, upload.</Empty>
      ) : (
        <ul className="space-y-3">
          {campaigns.map((c) => {
            const s = stats.get(c.id) ?? { ...EMPTY, total: c.total };
            const isRunning = c.status === "RUNNING";
            const reached = s.delivered + s.read;
            const done = c.total - s.queued;
            return (
              <li key={c.id}>
                <Link href={`/campaigns/${c.id}`} className={`card block p-4 transition hover:-translate-y-px hover:shadow-md sm:p-5 ${isRunning ? "ring-1 ring-brand-200" : ""}`}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-gray-900">{c.name}</p>
                      <p className="mt-0.5 text-xs text-gray-500">
                        {c.app.name} · <span className="font-mono">{c.template.elementName}</span> · by {c.createdBy.name} · {fmtDate(c.createdAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {c.status !== "DRAFT" ? <span className="text-sm font-semibold tabular-nums text-gray-900">{processedPct(s)}%</span> : null}
                      <Badge value={c.status} />
                    </div>
                  </div>
                  {c.status === "DRAFT" ? (
                    <p className="mt-3 text-sm text-amber-700">Uploaded, not started. {c.total.toLocaleString("en-IN")} recipients waiting for your review.</p>
                  ) : (
                    <>
                      <div className="mt-3">
                        <CampaignBar c={s} running={isRunning} />
                      </div>
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600">
                        <span className="tabular-nums">{done.toLocaleString("en-IN")} / {c.total.toLocaleString("en-IN")} processed</span>
                        <span className="tabular-nums text-emerald-700">{reached.toLocaleString("en-IN")} delivered{done ? ` (${Math.round((reached / done) * 100)}%)` : ""}</span>
                        <span className="tabular-nums text-brand-700">{s.read.toLocaleString("en-IN")} read</span>
                        {s.failed ? <span className="tabular-nums text-red-700">{s.failed.toLocaleString("en-IN")} failed</span> : null}
                        {isRunning ? (
                          <span className="text-gray-500">
                            <span className="soft-pulse mr-1 inline-block h-1.5 w-1.5 rounded-full bg-brand-500 align-middle" />
                            {live(c.id, s.queued)}
                          </span>
                        ) : null}
                      </div>
                    </>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
