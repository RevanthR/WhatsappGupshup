import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { appWhere, requireUser } from "@/lib/access";
import { daysAgo } from "@/lib/send";
import { Badge, Card, Empty, fmtDate, PageHeader, Stat } from "@/components/ui";

export const metadata = { title: "Dashboard" };

export default async function Dashboard() {
  const user = await requireUser();
  const since = daysAgo(7);
  const scope = { app: appWhere(user) };
  const [appCount, groups, unread, running, recent] = await Promise.all([
    prisma.app.count({ where: { ...appWhere(user), active: true } }),
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
      {appCount === 0 ? (
        <div className="mb-6">
          <Empty title="No apps connected yet">
            <Link href="/accounts" className="font-medium text-brand-700 hover:underline">Add a Gupshup account and app</Link> to start sending.
          </Empty>
        </div>
      ) : null}
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
