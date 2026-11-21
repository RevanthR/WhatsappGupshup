"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { activityAction, type Activity, type FinishedCampaign } from "@/app/actions/activity";
import { CampaignBar, processedPct } from "@/components/campaign-bar";
import { toast } from "@/components/toast";
import { chime } from "@/components/sound";

const TITLE_PREFIX = /^\d+% .*? \| /;

// Always-on helper in the app shell. Polls for running campaigns and new replies,
// shows a sending pill, a finish card, reply popups, and progress in the tab title.
export function ActivityWatcher() {
  const router = useRouter();
  const pathname = usePathname();
  const [data, setData] = useState<Activity | null>(null);
  const [done, setDone] = useState<FinishedCampaign[]>([]);
  const watch = useRef(new Set<string>());
  const since = useRef<string | null>(null);

  useEffect(() => {
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      let next = 12_000;
      try {
        const res = await activityAction([...watch.current], since.current);
        if (stop || !res) return;
        since.current = res.now;
        for (const c of res.running) watch.current.add(c.id);
        for (const f of res.finished) watch.current.delete(f.id);
        const completed = res.finished.filter((f) => f.status === "COMPLETED" || (f.status === "PAUSED" && f.pausedReason));
        if (completed.length) {
          setDone((d) => [...d.filter((x) => !completed.some((c) => c.id === x.id)), ...completed].slice(-2));
          chime();
        }
        if (res.replies.length) {
          for (const r of res.replies.slice(0, 2).reverse()) {
            toast(r.text, "reply", { title: `${r.from} · ${r.appName}`, href: r.contactId ? `/inbox?c=${r.contactId}` : "/inbox" });
          }
          chime();
        }
        if (res.replies.length || res.finished.length) router.refresh();
        setData(res);
        next = res.running.length ? 4_000 : 12_000;
      } catch {
        // Network blip. Try again on the next tick.
      }
      if (document.hidden) next = Math.max(next, 10_000);
      if (!stop) timer = setTimeout(tick, next);
    };
    timer = setTimeout(tick, 1500);
    return () => {
      stop = true;
      clearTimeout(timer);
    };
  }, [router]);

  // Progress in the browser tab, so it is visible from other tabs.
  const first = data?.running[0];
  const titlePct = first ? processedPct(first.counts) : null;
  useEffect(() => {
    const base = document.title.replace(TITLE_PREFIX, "");
    document.title = first && titlePct !== null ? `${titlePct}% ${first.name} | ${base}` : base;
  }, [first, titlePct, pathname]);

  const running = data?.running ?? [];
  const onOwnPage = running.length === 1 && pathname === `/campaigns/${running[0].id}`;

  return (
    <div className="pointer-events-none fixed bottom-4 left-4 z-40 flex w-[calc(100%-2rem)] max-w-xs flex-col gap-2 lg:left-[17rem]">
      {done.map((f) => {
        const reached = f.counts.delivered + f.counts.read;
        const paused = f.status === "PAUSED";
        return (
          <div key={f.id} className={`pop-in pointer-events-auto rounded-xl border bg-white p-4 shadow-lg ${paused ? "border-red-200" : "border-emerald-200"}`}>
            <div className="flex items-start gap-3">
              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${paused ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"}`}>{paused ? "!" : "✓"}</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-gray-900">{paused ? "Campaign paused automatically" : "Campaign finished"}</p>
                {paused ? <p className="text-xs text-red-700">WhatsApp flagged this number for spam.</p> : null}
                <p className="truncate text-sm text-gray-600">{f.name}</p>
                <p className="mt-1 text-xs text-gray-600">
                  <b className="text-emerald-700">{reached.toLocaleString("en-IN")}</b> delivered so far
                  {f.counts.waiting ? <> · {f.counts.waiting.toLocaleString("en-IN")} awaiting report</> : null}
                  {f.counts.failed ? <> · <b className="text-red-700">{f.counts.failed.toLocaleString("en-IN")}</b> failed</> : null}
                </p>
              </div>
              <button className="text-gray-400 hover:text-gray-700" aria-label="Dismiss" onClick={() => setDone((d) => d.filter((x) => x.id !== f.id))}>×</button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link href={`/campaigns/${f.id}`} className="btn-primary px-3 py-1.5 text-xs" onClick={() => setDone((d) => d.filter((x) => x.id !== f.id))}>View results</Link>
              <a href={`/api/campaigns/${f.id}/export`} className="btn-secondary px-3 py-1.5 text-xs">Download</a>
              {f.retryable && !paused ? (
                <Link href={`/campaigns/${f.id}?status=FAILED`} className="btn-secondary px-3 py-1.5 text-xs">Retry {f.retryable} failed</Link>
              ) : null}
            </div>
          </div>
        );
      })}
      {running.length && !onOwnPage ? (
        <Link
          href={`/campaigns/${running[0].id}`}
          className="pop-in pointer-events-auto block rounded-xl border border-gray-200 bg-white/95 p-3 shadow-lg backdrop-blur transition hover:-translate-y-px"
        >
          <div className="mb-2 flex items-center justify-between gap-2 text-xs">
            <span className="flex min-w-0 items-center gap-2 font-medium text-gray-900">
              <span className="soft-pulse inline-block h-2 w-2 shrink-0 rounded-full bg-brand-500" />
              <span className="truncate">{running.length > 1 ? `${running.length} campaigns sending` : `Sending ${running[0].name}`}</span>
            </span>
            <span className="shrink-0 font-semibold tabular-nums text-gray-900">{processedPct(running[0].counts)}%</span>
          </div>
          <CampaignBar c={running[0].counts} running size="sm" />
          <p className="mt-1.5 text-[11px] text-gray-500">
            {(running[0].counts.total - running[0].counts.queued).toLocaleString("en-IN")} of {running[0].counts.total.toLocaleString("en-IN")}
            {running[0].eta ? ` · ${running[0].eta}` : ""}
          </p>
        </Link>
      ) : null}
    </div>
  );
}
