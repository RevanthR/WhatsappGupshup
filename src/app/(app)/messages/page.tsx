import Link from "next/link";
import { ErrorText } from "@/components/error-text";
import { prisma } from "@/lib/prisma";
import { appWhere, requireUser } from "@/lib/access";
import { formatPhone } from "@/lib/phone";
import { Badge, Card, Empty, fmtDate, PageHeader, TableWrap } from "@/components/ui";
import type { Prisma, MessageStatus } from "@/generated/prisma/client";

export const metadata = { title: "Message log" };

const PAGE = 50;
const STATUSES = ["SUBMITTED", "SENT", "DELIVERED", "READ", "FAILED", "RECEIVED", "QUEUED"];

export default async function MessagesPage({ searchParams }: PageProps<"/messages">) {
  const sp = await searchParams;
  const user = await requireUser();
  const str = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const apps = await prisma.app.findMany({ where: appWhere(user), select: { id: true, name: true }, orderBy: { name: "asc" } });
  const app = str("app");
  const status = str("status");
  const dir = str("dir");
  const q = str("q").replace(/\D/g, "");
  const page = Math.max(1, Number(str("page")) || 1);

  const where: Prisma.MessageWhereInput = {
    app: appWhere(user),
    ...(app ? { appId: app } : {}),
    ...(STATUSES.includes(status) ? { status: status as MessageStatus } : {}),
    ...(dir === "in" ? { direction: "INBOUND" } : dir === "out" ? { direction: "OUTBOUND" } : {}),
    ...(q ? { phone: { contains: q } } : {}),
  };
  const [rows, count] = await Promise.all([
    prisma.message.findMany({
      where,
      include: {
        app: { select: { name: true } },
        template: { select: { elementName: true } },
        campaign: { select: { id: true, name: true } },
        sentBy: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE,
      take: PAGE,
    }),
    prisma.message.count({ where }),
  ]);
  const pages = Math.max(1, Math.ceil(count / PAGE));
  const qs = (o: Record<string, string | number>) => {
    const p = new URLSearchParams({ ...(app ? { app } : {}), ...(status ? { status } : {}), ...(dir ? { dir } : {}), ...(q ? { q } : {}) });
    for (const [k, v] of Object.entries(o)) p.set(k, String(v));
    return `?${p.toString()}`;
  };

  return (
    <>
      <PageHeader title="Message log" description={`${count.toLocaleString("en-IN")} message${count === 1 ? "" : "s"}`} />
      <form className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5" action="/messages">
        <select name="app" defaultValue={app} className="input">
          <option value="">All numbers</option>
          {apps.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <select name="status" defaultValue={status} className="input">
          <option value="">Any status</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</option>)}
        </select>
        <select name="dir" defaultValue={dir} className="input">
          <option value="">Sent and received</option>
          <option value="out">Sent only</option>
          <option value="in">Received only</option>
        </select>
        <input name="q" defaultValue={q} placeholder="Phone contains" className="input" inputMode="tel" />
        <button className="btn-secondary col-span-2 sm:col-span-1">Filter</button>
      </form>

      {rows.length === 0 ? (
        <Empty title="No messages match" />
      ) : (
        <>
          <ul className="space-y-3 md:hidden">
            {rows.map((m) => (
              <li key={m.id} className="card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-mono text-sm">{m.direction === "INBOUND" ? "← " : "→ "}{formatPhone(m.phone)}</p>
                    <p className="text-xs text-gray-500">{m.app.name}{m.template ? ` · ${m.template.elementName}` : ""} · {fmtDate(m.createdAt)}</p>
                  </div>
                  <Badge value={m.status} />
                </div>
                {m.text ? <p className="mt-2 line-clamp-3 text-sm text-gray-700">{m.text}</p> : null}
                {m.error ? <ErrorText error={m.error} className="mt-1 text-xs" /> : null}
              </li>
            ))}
          </ul>
          <Card className="hidden md:block">
            <TableWrap>
              <table className="table">
                <thead>
                  <tr><th>When</th><th>Number</th><th>From</th><th>Message</th><th>Source</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {rows.map((m) => (
                    <tr key={m.id}>
                      <td className="whitespace-nowrap text-gray-500">{fmtDate(m.createdAt)}</td>
                      <td className="whitespace-nowrap font-mono text-xs">
                        <span className={m.direction === "INBOUND" ? "text-violet-600" : "text-gray-400"}>{m.direction === "INBOUND" ? "← " : "→ "}</span>
                        {formatPhone(m.phone)}
                      </td>
                      <td className="text-gray-700">{m.app.name}</td>
                      <td className="max-w-md">
                        {m.template ? <p className="font-mono text-xs text-gray-500">{m.template.elementName}</p> : null}
                        <p className="line-clamp-2 text-gray-700">{m.text}</p>
                        {m.error ? <ErrorText error={m.error} className="mt-1 text-xs" /> : null}
                      </td>
                      <td className="text-xs text-gray-500">
                        {m.campaign ? <Link href={`/campaigns/${m.campaign.id}`} className="text-brand-700 hover:underline">{m.campaign.name}</Link> : m.sentBy?.name ?? (m.direction === "INBOUND" ? "Customer" : "")}
                      </td>
                      <td><Badge value={m.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          </Card>
          {pages > 1 ? (
            <div className="mt-4 flex items-center justify-between text-sm">
              <span className="text-gray-500">Page {page} of {pages}</span>
              <div className="flex gap-2">
                {page > 1 ? <Link href={qs({ page: page - 1 })} className="btn-secondary">Previous</Link> : null}
                {page < pages ? <Link href={qs({ page: page + 1 })} className="btn-secondary">Next</Link> : null}
              </div>
            </div>
          ) : null}
        </>
      )}
    </>
  );
}
