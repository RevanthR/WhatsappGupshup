import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { appWhere, requireUser } from "@/lib/access";
import { daysAgo } from "@/lib/send";
import { Badge, Card, fmtDate, PageHeader, Stat } from "@/components/ui";

export const metadata = { title: "Dashboard" };

export default async function Dashboard() {
  const user = await requireUser();
  const since = daysAgo(7);
  const scope = { app: appWhere(user) };
  const [apps, anySent, groups, unread, running, recent] = await Promise.all([
    prisma.app.findMany({
      where: { ...appWhere(user), active: true },
      select: { id: true, lastWebhookAt: true, _count: { select: { templates: { where: { status: "APPROVED" } } } } },
    }),
    prisma.message.findFirst({ where: { ...scope, direction: "OUTBOUND" }, select: { id: true } }),
    prisma.message.groupBy({ by: ["status"], where: { ...scope, createdAt: { gte: since } }, _count: true }),
    prisma.contact.count({ where: { ...scope, unreadCount: { gt: 0 } } }),
    prisma.campaign.findMany({
      where: { ...scope, status: { in: ["RUNNING", "PAUSED", "DRAFT"] } },
      include: { app: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.campaign.findMany({
      where: { ...scope, status: { in: ["COMPLETED", "CANCELLED"] } },
      include: { app: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);
  const n = (...s: string[]) => groups.filter((g) => s.includes(g.status)).reduce((a, g) => a + g._count, 0);
  const sent = n("SUBMITTED", "ENQUEUED", "SENT", "DELIVERED", "READ", "FAILED", "SENDING");
  const delivered = n("DELIVERED", "READ");
  const read = n("READ");
  const failed = n("FAILED");
  const received = n("RECEIVED");
  const pct = (x: number) => (sent ? `${Math.round((x / sent) * 100)}% of sent` : "");

  return (
    <>
      <PageHeader
        title={`Hello, ${user.name.split(" ")[0]}`}
        description="Last 7 days across your apps."
        actions={
          <>
            <Link href="/send" className="btn-secondary">Send one</Link>
            <Link href="/bulk" className="btn-primary">Bulk send</Link>
          </>
        }
      />
      <GetStarted
        steps={[
          { done: apps.length > 0, title: "Connect a WhatsApp number", text: "Link your Gupshup app with its API key.", href: "/numbers/new", cta: "Connect" },
          {
            done: apps.some((a) => a._count.templates > 0),
            title: "Have an approved template",
            text: "Create templates in Gupshup. Once WhatsApp approves them, sync here.",
            href: apps[0] ? `/numbers/${apps[0].id}?tab=templates` : "/templates",
            cta: "View templates",
          },
          {
            done: apps.some((a) => a.lastWebhookAt),
            title: "Set up the webhook",
            text: "Paste one URL in Gupshup to get delivery reports and replies.",
            href: apps[0] ? `/numbers/${apps[0].id}?tab=webhook` : "/numbers",
            cta: "Set up",
          },
          { done: !!anySent, title: "Send your first message", text: "Try it on your own number first.", href: "/send", cta: "Send" },
        ]}
      />
      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-6">
        <Stat label="Sent" value={sent.toLocaleString("en-IN")} href="/messages?dir=out" />
        <Stat label="Delivered" value={delivered.toLocaleString("en-IN")} sub={pct(delivered)} href="/messages?status=DELIVERED" />
        <Stat label="Read" value={read.toLocaleString("en-IN")} sub={pct(read)} href="/messages?status=READ" />
        <Stat label="Failed" value={failed.toLocaleString("en-IN")} sub={pct(failed)} href="/messages?status=FAILED" />
        <Stat label="Replies" value={received.toLocaleString("en-IN")} href="/messages?dir=in" />
        <Stat label="Unread chats" value={unread} href="/inbox?unread=1" />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Active campaigns" actions={<Link href="/campaigns" className="text-sm text-brand-700 hover:underline">All</Link>}>
          {running.length === 0 ? (
            <p className="text-sm text-gray-500">Nothing running.</p>
          ) : (
            <ul className="-my-2 divide-y divide-gray-100">
              {running.map((c) => (
                <li key={c.id}>
                  <Link href={`/campaigns/${c.id}`} className="flex items-center justify-between gap-3 py-2.5 hover:opacity-80">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-gray-900">{c.name}</span>
                      <span className="text-xs text-gray-500">{c.app.name} · {c.total} recipients</span>
                    </span>
                    <Badge value={c.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Recently finished">
          {recent.length === 0 ? (
            <p className="text-sm text-gray-500">No finished campaigns yet.</p>
          ) : (
            <ul className="-my-2 divide-y divide-gray-100">
              {recent.map((c) => (
                <li key={c.id}>
                  <Link href={`/campaigns/${c.id}`} className="flex items-center justify-between gap-3 py-2.5 hover:opacity-80">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-gray-900">{c.name}</span>
                      <span className="text-xs text-gray-500">{c.app.name} · {fmtDate(c.completedAt ?? c.createdAt)}</span>
                    </span>
                    <Badge value={c.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}

function GetStarted({ steps }: { steps: { done: boolean; title: string; text: string; href: string; cta: string }[] }) {
  const doneCount = steps.filter((s) => s.done).length;
  if (doneCount === steps.length) return null;
  const next = steps.findIndex((s) => !s.done);
  return (
    <div className="card mb-6 p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold text-gray-900">Get started</h2>
          <p className="text-sm text-gray-500">{doneCount} of {steps.length} done</p>
        </div>
        <div className="h-2 w-32 overflow-hidden rounded-full bg-gray-100">
          <div className="h-full rounded-full bg-brand-500" style={{ width: `${(doneCount / steps.length) * 100}%` }} />
        </div>
      </div>
      <ol className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {steps.map((s, i) => (
          <li key={s.title} className={`rounded-lg border p-3 ${i === next ? "border-brand-500 bg-brand-50" : "border-gray-200"}`}>
            <p className="flex items-center gap-2 text-sm font-medium text-gray-900">
              <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] ${s.done ? "bg-emerald-600 text-white" : "bg-gray-200 text-gray-600"}`}>
                {s.done ? "✓" : i + 1}
              </span>
              {s.title}
            </p>
            <p className="mt-1 text-xs text-gray-600">{s.text}</p>
            {!s.done ? (
              <Link href={s.href} className={`mt-2 inline-block text-xs font-medium ${i === next ? "btn-primary px-3 py-1.5" : "text-brand-700 hover:underline"}`}>
                {s.cta}
              </Link>
            ) : null}
          </li>
        ))}
      </ol>
    </div>
  );
}
