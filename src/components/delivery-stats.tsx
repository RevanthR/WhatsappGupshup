import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ErrorText } from "@/components/error-text";
import type { Prisma } from "@/generated/prisma/client";

type Props = {
  // Outbound messages to count. Direction is added here.
  where: Prisma.MessageWhereInput;
  // Inbound messages to count as replies. Leave out to hide the replies tile.
  repliesWhere?: Prisma.MessageWhereInput;
  // Builds a link for a tile, from a message log status filter.
  link?: (status: string) => string;
  showReasons?: boolean;
};

const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 1000) / 10}%` : "0%");

// Delivery funnel for a set of sent messages: totals, rates, a split bar and top failure reasons.
export async function DeliveryStats({ where, repliesWhere, link, showReasons = true }: Props) {
  const out: Prisma.MessageWhereInput = { AND: [where, { direction: "OUTBOUND" }] };
  const [groups, replies, reasons] = await Promise.all([
    prisma.message.groupBy({ by: ["status"], where: out, _count: true }),
    repliesWhere ? prisma.message.count({ where: { AND: [repliesWhere, { direction: "INBOUND" }] } }) : Promise.resolve(null),
    showReasons
      ? prisma.message.groupBy({
          by: ["error"],
          where: { AND: [out, { status: "FAILED" }] },
          _count: true,
          orderBy: { _count: { error: "desc" } },
          take: 3,
        })
      : Promise.resolve([]),
  ]);
  const n = (...s: string[]) => groups.filter((g) => s.includes(g.status)).reduce((a, g) => a + g._count, 0);
  const total = groups.reduce((a, g) => a + g._count, 0);
  const queued = n("QUEUED", "SENDING");
  const waiting = n("SUBMITTED", "ENQUEUED", "SENT");
  const delivered = n("DELIVERED");
  const read = n("READ");
  const failed = n("FAILED");
  const done = total - queued;
  const reachedPhone = delivered + read;

  const tiles = [
    { key: "", label: "Sent", value: total, sub: queued ? `${queued.toLocaleString("en-IN")} still in queue` : "Messages sent", tone: "text-gray-900" },
    { key: "DELIVERED", label: "Delivered", value: reachedPhone, sub: `${pct(reachedPhone, done)} of processed`, tone: "text-emerald-700" },
    { key: "READ", label: "Read", value: read, sub: `${pct(read, reachedPhone)} of delivered`, tone: "text-brand-700" },
    { key: "WAITING", label: "Not delivered yet", value: waiting, sub: "Sent to WhatsApp, no delivery report", tone: "text-sky-700" },
    { key: "FAILED", label: "Failed", value: failed, sub: `${pct(failed, done)} of processed`, tone: "text-red-700" },
    ...(replies !== null ? [{ key: "REPLIES", label: "Replies", value: replies, sub: "Messages from customers", tone: "text-violet-700" }] : []),
  ];
  const bar = [
    { v: read, cls: "bg-brand-500", label: "Read" },
    { v: delivered, cls: "bg-emerald-500", label: "Delivered" },
    { v: waiting, cls: "bg-sky-400", label: "Not delivered yet" },
    { v: failed, cls: "bg-red-500", label: "Failed" },
    { v: queued, cls: "bg-gray-300", label: "In queue" },
  ];

  return (
    <div className="mb-6 space-y-3">
      <div className={`grid grid-cols-2 gap-3 sm:grid-cols-3 ${tiles.length > 5 ? "xl:grid-cols-6" : "xl:grid-cols-5"}`}>
        {tiles.map((t) => {
          const body = (
            <div className="card h-full p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{t.label}</p>
              <p className={`mt-1 text-2xl font-semibold tabular-nums ${t.tone}`}>{t.value.toLocaleString("en-IN")}</p>
              <p className="mt-1 text-xs text-gray-500">{t.sub}</p>
            </div>
          );
          const href = link ? link(t.key) : null;
          return href ? (
            <Link key={t.label} href={href} className="block transition hover:-translate-y-px">{body}</Link>
          ) : (
            <div key={t.label}>{body}</div>
          );
        })}
      </div>
      {total ? (
        <div className="card p-4">
          <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-gray-100" role="img" aria-label="Delivery split">
            {bar.map((b) => (b.v ? <div key={b.label} className={`h-full ${b.cls}`} style={{ width: `${(b.v / total) * 100}%` }} title={`${b.label}: ${b.v}`} /> : null))}
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600">
            {bar.map((b) => (b.v ? (
              <span key={b.label} className="inline-flex items-center gap-1.5">
                <span className={`inline-block h-2 w-2 rounded-full ${b.cls}`} />
                {b.label} {b.v.toLocaleString("en-IN")} ({pct(b.v, total)})
              </span>
            ) : null))}
          </div>
          {reasons.length ? (
            <div className="mt-4 border-t border-gray-100 pt-3">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">Top failure reasons</p>
              <ul className="space-y-2">
                {reasons.map((r) => (
                  <li key={r.error ?? "none"} className="flex items-start justify-between gap-3 text-sm">
                    <ErrorText error={r.error ?? "Unknown error"} className="min-w-0" />
                    <span className="shrink-0 tabular-nums text-gray-500">{r._count.toLocaleString("en-IN")}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
