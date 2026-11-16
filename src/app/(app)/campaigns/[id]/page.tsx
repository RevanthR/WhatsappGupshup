import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { appWhere, requireUser } from "@/lib/access";
import { isStalled } from "@/lib/worker";
import { varLabels } from "@/lib/template-vars";
import {
  cancelCampaignAction,
  pauseCampaignAction,
  resumeStalledAction,
  startCampaignAction,
} from "@/app/actions/campaigns";
import { ConfirmButton, SubmitButton } from "@/components/action-form";
import { Alert, Badge, Card, fmtDate, PageHeader, Stat, TableWrap } from "@/components/ui";
import { TemplatePreview } from "@/components/template-preview";
import { LiveRefresh } from "./live";

const PAGE = 50;

export default async function CampaignPage({ params, searchParams }: PageProps<"/campaigns/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const user = await requireUser();
  const c = await prisma.campaign.findFirst({
    where: { id, app: appWhere(user) },
    include: { app: true, template: true, createdBy: { select: { name: true } } },
  });
  if (!c) notFound();

  const filter = typeof sp.status === "string" ? sp.status : "";
  const page = Math.max(1, Number(sp.page) || 1);
  const where = {
    campaignId: id,
    ...(filter === "FAILED" ? { status: "FAILED" as const } : {}),
    ...(filter === "PENDING" ? { status: { in: ["QUEUED" as const, "SENDING" as const] } } : {}),
    ...(filter === "DELIVERED" ? { status: { in: ["DELIVERED" as const, "READ" as const] } } : {}),
  };
  const [groups, rows, filteredCount] = await Promise.all([
    prisma.message.groupBy({ by: ["status"], where: { campaignId: id }, _count: true }),
    prisma.message.findMany({ where, orderBy: { rowNumber: "asc" }, skip: (page - 1) * PAGE, take: PAGE }),
    prisma.message.count({ where }),
  ]);
  const n = (...s: string[]) => groups.filter((g) => s.includes(g.status)).reduce((a, g) => a + g._count, 0);
  const pending = n("QUEUED", "SENDING");
  const accepted = n("SUBMITTED", "ENQUEUED", "SENT", "DELIVERED", "READ");
  const delivered = n("DELIVERED", "READ");
  const read = n("READ");
  const failed = n("FAILED");
  const processed = c.total - pending;
  const pct = c.total ? Math.round((processed / c.total) * 100) : 0;
  const labels = varLabels(c.template);
  const skipped = Array.isArray(c.skippedRows) ? (c.skippedRows as { row: number; raw: string; reason: string }[]) : [];
  const stalled = isStalled(c);
  const pages = Math.max(1, Math.ceil(filteredCount / PAGE));
  const qs = (o: Record<string, string | number>) => {
    const p = new URLSearchParams({ ...(filter ? { status: filter } : {}), ...Object.fromEntries(Object.entries(o).map(([k, v]) => [k, String(v)])) });
    return `?${p.toString()}`;
  };

  return (
    <>
      <LiveRefresh active={c.status === "RUNNING"} campaignId={c.id} />
      <PageHeader
        title={c.name}
        description={
          <>
            <Link href="/campaigns" className="text-brand-700 hover:underline">Campaigns</Link> · {c.app.name} ·{" "}
            <span className="font-mono">{c.template.elementName}</span> · by {c.createdBy.name} · {fmtDate(c.createdAt)}
          </>
        }
        actions={
          <>
            <Badge value={c.status} />
            {c.status !== "DRAFT" ? <a href={`/api/campaigns/${c.id}/export`} className="btn-secondary">Download results</a> : null}
          </>
        }
      />

      {c.status === "DRAFT" ? (
        <Card className="mb-6" title="Review before sending">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-3 text-sm text-gray-700">
              <p><b className="text-gray-900">{c.total}</b> valid recipient{c.total === 1 ? "" : "s"} from <span className="font-mono">{c.fileName}</span>.</p>
              {skipped.length ? <p className="text-amber-700"><b>{skipped.length}</b> row{skipped.length === 1 ? "" : "s"} skipped (listed below). They will not be sent.</p> : null}
              <p>Messages go out in small batches. You can pause or cancel at any time.</p>
              <div className="flex flex-wrap gap-2 pt-2">
                <form action={startCampaignAction}>
                  <input type="hidden" name="id" value={c.id} />
                  <SubmitButton pendingLabel="Starting..." toastText="Sending started. Progress updates live on this page.">Start sending to {c.total}</SubmitButton>
                </form>
                <ConfirmButton action={cancelCampaignAction} fields={{ id: c.id }} label="Discard" confirm="Discard this upload?" className="btn-secondary" />
              </div>
            </div>
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">First message preview</p>
              <TemplatePreview template={c.template} params={(rows[0]?.params as string[]) ?? []} mediaUrl={rows[0]?.mediaUrl ?? undefined} />
            </div>
          </div>
        </Card>
      ) : (
        <>
          {stalled ? (
            <div className="mb-4">
              <Alert tone="warning">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span>Sending has not moved for a few minutes. It restarts automatically while this page is open.</span>
                  <form action={resumeStalledAction}>
                    <input type="hidden" name="id" value={c.id} />
                    <SubmitButton className="btn-secondary" pendingLabel="Restarting..." toastText="Restarted.">Resume now</SubmitButton>
                  </form>
                </div>
              </Alert>
            </div>
          ) : null}
          <div className="card mb-6 p-4 sm:p-5">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="font-medium text-gray-900">{processed} of {c.total} processed ({pct}%)</span>
              <div className="flex flex-wrap gap-2">
                {c.status === "RUNNING" ? (
                  <form action={pauseCampaignAction}><input type="hidden" name="id" value={c.id} /><SubmitButton className="btn-secondary" pendingLabel="Pausing..." toastText="Paused. Messages already sent are not affected.">Pause</SubmitButton></form>
                ) : null}
                {c.status === "PAUSED" ? (
                  <form action={startCampaignAction}><input type="hidden" name="id" value={c.id} /><SubmitButton pendingLabel="Resuming..." toastText="Resumed.">Resume</SubmitButton></form>
                ) : null}
                {c.status === "RUNNING" || c.status === "PAUSED" ? (
                  <ConfirmButton action={cancelCampaignAction} fields={{ id: c.id }} label="Cancel" confirm={`Stop and skip ${pending} unsent?`} toastText="Campaign cancelled." />
                ) : null}
              </div>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-100">
              <div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${pct}%` }} />
            </div>
          </div>
          <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-6">
            <Stat label="Total" value={c.total} />
            <Stat label="Waiting" value={pending} href="?status=PENDING" />
            <Stat label="Accepted" value={accepted} sub="by Gupshup" />
            <Stat label="Delivered" value={delivered} sub={c.total ? `${Math.round((delivered / c.total) * 100)}%` : ""} href={`?status=DELIVERED`} />
            <Stat label="Read" value={read} sub={c.total ? `${Math.round((read / c.total) * 100)}%` : ""} />
            <Stat label="Failed" value={failed} href={`?status=FAILED`} />
          </div>
        </>
      )}

      <Card
        title="Recipients"
        actions={
          <div className="flex flex-wrap gap-1 text-xs">
            {[["", "All"], ["PENDING", "Waiting"], ["DELIVERED", "Delivered"], ["FAILED", "Failed"]].map(([v, l]) => (
              <Link key={v} href={v ? `?status=${v}` : "?"} className={`rounded-full px-2.5 py-1 ${filter === v ? "bg-brand-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}>{l}</Link>
            ))}
          </div>
        }
      >
        <TableWrap>
          <table className="table min-w-[640px]">
            <thead>
              <tr><th>Row</th><th>Phone</th>{labels.map((l) => <th key={l}>{l}</th>)}<th>Status</th><th>Detail</th></tr>
            </thead>
            <tbody>
              {rows.map((m) => {
                const p = Array.isArray(m.params) ? (m.params as string[]) : [];
                return (
                  <tr key={m.id}>
                    <td className="text-gray-500">{m.rowNumber}</td>
                    <td className="font-mono text-xs">+{m.phone}</td>
                    {labels.map((l, i) => <td key={l} className="max-w-[12rem] truncate">{p[i]}</td>)}
                    <td><Badge value={m.status} /></td>
                    <td className="max-w-xs text-xs text-gray-500">{m.error ?? fmtDate(m.readAt ?? m.deliveredAt ?? m.sentAt ?? m.submittedAt)}</td>
                  </tr>
                );
              })}
              {rows.length === 0 ? <tr><td colSpan={labels.length + 4} className="py-6 text-center text-gray-500">Nothing here.</td></tr> : null}
            </tbody>
          </table>
        </TableWrap>
        {pages > 1 ? (
          <div className="mt-4 flex items-center justify-between text-sm">
            <span className="text-gray-500">Page {page} of {pages}</span>
            <div className="flex gap-2">
              {page > 1 ? <Link href={qs({ page: page - 1 })} className="btn-secondary">Previous</Link> : null}
              {page < pages ? <Link href={qs({ page: page + 1 })} className="btn-secondary">Next</Link> : null}
            </div>
          </div>
        ) : null}
      </Card>

      {skipped.length ? (
        <Card className="mt-6" title={`Skipped rows (${skipped.length})`}>
          <TableWrap>
            <table className="table">
              <thead><tr><th>Row</th><th>Phone</th><th>Problem</th></tr></thead>
              <tbody>
                {skipped.slice(0, 500).map((r) => (
                  <tr key={r.row}><td>{r.row}</td><td className="font-mono text-xs">{r.raw || "(empty)"}</td><td className="text-red-700">{r.reason}</td></tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        </Card>
      ) : null}
    </>
  );
}
