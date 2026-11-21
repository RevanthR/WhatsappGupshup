"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { ActivityWatcher } from "@/components/activity-watcher";
import { setSound, useSound } from "@/components/sound";

type NavItem = { href: string; label: string; icon: ReactNode; badge?: number; also?: string[] };
type NavGroup = { title?: string; admin?: boolean; items: NavItem[] };

const I = {
  home: <path d="M3 10.5 12 3l9 7.5V21H15v-6H9v6H3z" />,
  send: <path d="M3 11.5 21 3l-8.5 18-2.2-7.3z" />,
  bulk: <path d="M4 4h16v4H4zM4 10h16v4H4zM4 16h16v4H4z" />,
  inbox: <path d="M3 13h5l2 3h4l2-3h5M5 4h14l2 9v7H3v-7z" />,
  log: <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />,
  acct: <path d="M3 21V7l9-4 9 4v14M9 21v-6h6v6" />,
  tpl: <path d="M4 5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v14l-4-3H6a2 2 0 0 1-2-2zM8 8h8M8 12h5" />,
  phone: <path d="M7 2h10a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1zM11 18h2" />,
  users: <path d="M16 21v-2a4 4 0 0 0-8 0v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.9M2 21v-2a4 4 0 0 1 3-3.9" />,
};

function Icon({ d }: { d: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] shrink-0" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      {d}
    </svg>
  );
}

export function Shell({
  user,
  unread,
  signOutAction,
  children,
}: {
  user: { name: string; email: string; role: string };
  unread: number;
  signOutAction: () => Promise<void>;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const sound = useSound();

  const groups: NavGroup[] = [
    {
      items: [
        { href: "/", label: "Dashboard", icon: I.home },
        { href: "/send", label: "Send message", icon: I.send },
        { href: "/campaigns", label: "Bulk send", icon: I.bulk, also: ["/bulk"] },
        { href: "/inbox", label: "Inbox", icon: I.inbox, badge: unread },
        { href: "/messages", label: "Message log", icon: I.log },
      ],
    },
    {
      title: "Setup",
      items: [
        { href: "/numbers", label: "WhatsApp numbers", icon: I.phone, also: ["/accounts"] },
        { href: "/templates", label: "Templates", icon: I.tpl },
      ],
    },
    { title: "Admin", admin: true, items: [{ href: "/users", label: "Users", icon: I.users }] },
  ];
  const visible = groups.filter((g) => !g.admin || user.role === "SUPER_ADMIN");
  const isActive = (item: NavItem) =>
    item.href === "/" ? pathname === "/" : [item.href, ...(item.also ?? [])].some((h) => pathname.startsWith(h));

  const nav = (
    <nav className="flex flex-1 flex-col gap-4 p-3">
      {visible.map((g, gi) => (
        <div key={gi} className="flex flex-col gap-0.5">
          {g.title ? <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-gray-400">{g.title}</p> : null}
          {g.items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                isActive(item) ? "bg-brand-50 text-brand-700" : "text-gray-700 hover:bg-gray-100"
              }`}
            >
              <Icon d={item.icon} />
              <span className="flex-1">{item.label}</span>
              {item.badge ? (
                <span className="rounded-full bg-brand-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">{item.badge > 99 ? "99+" : item.badge}</span>
              ) : null}
            </Link>
          ))}
        </div>
      ))}
    </nav>
  );

  const footer = (
    <div className="border-t border-gray-200 p-3">
      <div className="px-3 py-2">
        <p className="truncate text-sm font-medium text-gray-900">{user.name}</p>
        <p className="truncate text-xs text-gray-500">{user.email}</p>
        {user.role === "SUPER_ADMIN" ? <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-violet-600">Super admin</p> : null}
      </div>
      <div className="flex gap-1">
        <button
          className="btn-ghost flex-1 text-xs"
          onClick={() => setSound(!sound)}
          title="Play a soft sound for new replies and finished campaigns"
          aria-pressed={sound}
        >
          {sound ? "Sound on" : "Sound off"}
        </button>
        <Link href="/change-password" onClick={() => setOpen(false)} className="btn-ghost flex-1 text-xs">
          Password
        </Link>
        <form action={signOutAction} className="flex-1">
          <button className="btn-ghost w-full text-xs">Sign out</button>
        </form>
      </div>
    </div>
  );

  const brand = (
    <Link href="/" className="flex items-center gap-2 font-semibold text-gray-900">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white">
        <Icon d={I.send} />
      </span>
      WA Sender
    </Link>
  );

  return (
    <div className="min-h-screen lg:flex">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-gray-200 bg-white lg:flex">
        <div className="flex h-16 items-center px-6">{brand}</div>
        {nav}
        {footer}
      </aside>

      {/* Mobile and tablet top bar */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-gray-200 bg-white/95 px-4 backdrop-blur lg:hidden">
        {brand}
        <button aria-label="Open menu" className="btn-ghost -mr-2 px-2" onClick={() => setOpen(true)}>
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round">
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
          {unread ? <span className="h-2 w-2 rounded-full bg-brand-600" /> : null}
        </button>
      </header>

      {open ? (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-gray-900/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 right-0 flex w-72 max-w-[85vw] flex-col bg-white shadow-xl">
            <div className="flex h-14 items-center justify-between px-4">
              {brand}
              <button aria-label="Close menu" className="btn-ghost -mr-2 px-2" onClick={() => setOpen(false)}>
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round">
                  <path d="M6 6l12 12M18 6 6 18" />
                </svg>
              </button>
            </div>
            <div className="flex flex-1 flex-col overflow-y-auto">{nav}</div>
            {footer}
          </aside>
        </div>
      ) : null}

      <ActivityWatcher />
      <main className="min-w-0 flex-1">
        <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</div>
      </main>
    </div>
  );
}
