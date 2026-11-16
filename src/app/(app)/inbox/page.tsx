import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { appWhere, requireUser } from "@/lib/access";
import { formatPhone } from "@/lib/phone";
import { windowHoursLeft, windowOpen } from "@/lib/send";
import { Badge, Empty, fmtDate } from "@/components/ui";
import { ReplyBox, InboxPoller } from "./client";

export const metadata = { title: "Inbox" };

export default async function InboxPage({ searchParams }: PageProps<"/inbox">) {
  const sp = await searchParams;
  const user = await requireUser();
  const apps = await prisma.app.findMany({ where: appWhere(user), select: { id: true, name: true }, orderBy: { name: "asc" } });
  const appFilter = typeof sp.app === "string" && apps.some((a) => a.id === sp.app) ? sp.app : "";
  const q = typeof sp.q === "string" ? sp.q.replace(/\D/g, "") : "";
  const unreadOnly = sp.unread === "1";

  const contacts = await prisma.contact.findMany({
    where: {
      app: appWhere(user),
      ...(appFilter ? { appId: appFilter } : {}),
      ...(q ? { phone: { contains: q } } : {}),
      ...(unreadOnly ? { unreadCount: { gt: 0 } } : {}),
      // Inbox shows conversations where the customer has written at least once.
      lastInboundAt: { not: null },
    },
    include: { app: { select: { name: true } } },
    orderBy: { lastMessageAt: "desc" },
    take: 100,
  });

  const selectedId = typeof sp.c === "string" ? sp.c : "";
  const selected = selectedId
    ? await prisma.contact.findFirst({ where: { id: selectedId, app: appWhere(user) }, include: { app: { select: { id: true, name: true } } } })
    : null;
  const thread = selected
    ? (
        await prisma.message.findMany({
          where: { contactId: selected.id },
          orderBy: { createdAt: "desc" },
          take: 200,
          include: { sentBy: { select: { name: true } } },
        })
      ).reverse()
    : [];
  if (selected && selected.unreadCount > 0) {
    await prisma.contact.update({ where: { id: selected.id }, data: { unreadCount: 0 } });
  }

  const link = (o: Record<string, string>) => {
    const p = new URLSearchParams({
      ...(appFilter ? { app: appFilter } : {}),
      ...(q ? { q } : {}),
      ...(unreadOnly ? { unread: "1" } : {}),
      ...o,
    });
    for (const [k, v] of [...p.entries()]) if (!v) p.delete(k);
    return `/inbox?${p.toString()}`;
  };
  const open = selected ? windowOpen(selected.lastInboundAt) : false;
  const hoursLeft = windowHoursLeft(selected?.lastInboundAt);

  return (
    <div className="-mx-4 -my-6 sm:-mx-6 lg:-mx-8 lg:-my-8">
      <InboxPoller />
      <div className="flex h-[calc(100dvh-3.5rem)] lg:h-dvh">
        {/* Conversation list */}
        <aside className={`${selected ? "hidden md:flex" : "flex"} w-full flex-col border-r border-gray-200 bg-white md:w-80 lg:w-96`}>
          <div className="space-y-2 border-b border-gray-200 p-3">
            <h1 className="px-1 text-lg font-semibold text-gray-900">Inbox</h1>
            <form className="flex gap-2" action="/inbox">
              <select name="app" defaultValue={appFilter} className="input w-1/2">
                <option value="">All apps</option>
                {apps.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
              <input name="q" defaultValue={q} placeholder="Search number" className="input w-1/2" inputMode="tel" />
              <button className="sr-only">Filter</button>
            </form>
            <div className="flex gap-1 text-xs">
              <Link href={link({ unread: "" })} className={`rounded-full px-2.5 py-1 ${!unreadOnly ? "bg-brand-600 text-white" : "bg-gray-100 text-gray-700"}`}>All</Link>
              <Link href={link({ unread: "1" })} className={`rounded-full px-2.5 py-1 ${unreadOnly ? "bg-brand-600 text-white" : "bg-gray-100 text-gray-700"}`}>Unread</Link>
            </div>
          </div>
          <ul className="flex-1 divide-y divide-gray-100 overflow-y-auto">
            {contacts.map((c) => (
              <li key={c.id}>
                <Link href={link({ c: c.id })} className={`block px-4 py-3 hover:bg-gray-50 ${c.id === selected?.id ? "bg-brand-50" : ""}`}>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className={`truncate text-sm ${c.unreadCount ? "font-semibold text-gray-900" : "font-medium text-gray-800"}`}>
                      {c.name || formatPhone(c.phone)}
                    </span>
                    <span className="shrink-0 text-[11px] text-gray-500">{fmtDate(c.lastMessageAt)}</span>
                  </div>
                  <div className="mt-0.5 flex items-center justify-between gap-2">
                    <span className="truncate text-xs text-gray-500">{c.lastPreview}</span>
                    {c.unreadCount ? <span className="shrink-0 rounded-full bg-brand-600 px-1.5 text-[10px] font-semibold text-white">{c.unreadCount}</span> : null}
                  </div>
                  {!appFilter && apps.length > 1 ? <p className="mt-0.5 text-[11px] text-gray-400">{c.app.name}</p> : null}
                </Link>
              </li>
            ))}
            {contacts.length === 0 ? <li className="p-6 text-center text-sm text-gray-500">No conversations yet. Replies show up here once the webhook is set in Gupshup.</li> : null}
          </ul>
        </aside>

        {/* Thread */}
        <section className={`${selected ? "flex" : "hidden md:flex"} min-w-0 flex-1 flex-col bg-[#efeae2]`}>
          {selected ? (
            <>
              <header className="flex items-center gap-3 border-b border-gray-200 bg-white px-4 py-3">
                <Link href={link({ c: "" })} className="btn-ghost -ml-2 px-2 md:hidden" aria-label="Back">
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M15 18l-6-6 6-6" /></svg>
                </Link>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-gray-900">{selected.name || formatPhone(selected.phone)}</p>
                  <p className="truncate text-xs text-gray-500">{selected.name ? `${formatPhone(selected.phone)} · ` : ""}{selected.app.name}</p>
                </div>
                <Link href={`/send?app=${selected.app.id}&phone=${selected.phone}`} className="btn-secondary text-xs">Send template</Link>
              </header>
              <ThreadScroll>
                {thread.map((m) => (
                  <div key={m.id} className={`flex ${m.direction === "OUTBOUND" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm shadow-sm sm:max-w-[70%] ${m.direction === "OUTBOUND" ? "bg-[#d9fdd3]" : "bg-white"}`}>
                      {m.mediaUrl && m.direction === "INBOUND" ? (
                        <a href={m.mediaUrl} target="_blank" rel="noreferrer" className="mb-1 block text-xs font-medium text-brand-700 underline">Open {m.type}</a>
                      ) : null}
                      {m.text ? <p className="whitespace-pre-wrap break-words text-gray-800">{m.text}</p> : <p className="italic text-gray-500">[{m.type}]</p>}
                      <div className="mt-1 flex flex-wrap items-center justify-end gap-1.5 text-[10px] text-gray-500">
                        {m.direction === "OUTBOUND" && m.sentBy ? <span>{m.sentBy.name}</span> : null}
                        {m.campaignId ? <span>campaign</span> : null}
                        <span>{fmtDate(m.createdAt)}</span>
                        {m.direction === "OUTBOUND" ? <Badge value={m.status} /> : null}
                      </div>
                      {m.error ? <p className="mt-1 text-[11px] text-red-700">{m.error}</p> : null}
                    </div>
                  </div>
                ))}
              </ThreadScroll>
              <div className="border-t border-gray-200 bg-white p-3">
                {open ? (
                  <>
                    <ReplyBox contactId={selected.id} />
                    <p className="mt-1 text-[11px] text-gray-500">Reply window open for about {hoursLeft} more hour{hoursLeft === 1 ? "" : "s"}.</p>
                  </>
                ) : (
                  <p className="text-sm text-gray-600">
                    The 24-hour reply window is closed. <Link href={`/send?app=${selected.app.id}&phone=${selected.phone}`} className="font-medium text-brand-700 hover:underline">Send an approved template</Link> to restart the conversation.
                  </p>
                )}
              </div>
            </>
          ) : (
            <div className="m-auto p-6">
              <Empty title="Pick a conversation">Customer replies to your WhatsApp numbers appear on the left.</Empty>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function ThreadScroll({ children }: { children: React.ReactNode }) {
  // flex-col-reverse keeps the newest message in view without client JS.
  return (
    <div className="flex flex-1 flex-col-reverse overflow-y-auto p-3 sm:p-4">
      <div className="space-y-2">{children}</div>
    </div>
  );
}
