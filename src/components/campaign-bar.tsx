// Split progress bar for a campaign: read, delivered, waiting, failed, with the unsent part empty.
// Plain markup, so it works in server and client components.

export type BarCounts = { total: number; queued: number; waiting: number; delivered: number; read: number; failed: number };

const SEGMENTS = [
  { key: "read", label: "Read", cls: "bg-brand-500" },
  { key: "delivered", label: "Delivered", cls: "bg-emerald-500" },
  { key: "waiting", label: "Sent", cls: "bg-sky-400" },
  { key: "failed", label: "Failed", cls: "bg-red-500" },
] as const;

export function processedPct(c: BarCounts) {
  return c.total ? Math.round(((c.total - c.queued) / c.total) * 100) : 0;
}

export function CampaignBar({ c, running = false, size = "md", legend = false }: { c: BarCounts; running?: boolean; size?: "sm" | "md" | "lg"; legend?: boolean }) {
  const h = size === "sm" ? "h-1.5" : size === "lg" ? "h-3" : "h-2";
  return (
    <div>
      <div className={`relative flex ${h} w-full overflow-hidden rounded-full bg-gray-100`} role="progressbar" aria-valuenow={processedPct(c)} aria-valuemin={0} aria-valuemax={100}>
        {SEGMENTS.map((s) => {
          const v = c[s.key];
          return v ? <div key={s.key} className={`h-full ${s.cls} transition-[width] duration-700 ease-out`} style={{ width: `${(v / (c.total || 1)) * 100}%` }} title={`${s.label}: ${v}`} /> : null;
        })}
        {running ? <div className="progress-stripes pointer-events-none absolute inset-0" /> : null}
      </div>
      {legend ? (
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600">
          {SEGMENTS.map((s) => (
            <span key={s.key} className="inline-flex items-center gap-1.5">
              <span className={`inline-block h-2 w-2 rounded-full ${s.cls}`} />
              {s.label} <b className="font-semibold tabular-nums text-gray-800">{c[s.key].toLocaleString("en-IN")}</b>
            </span>
          ))}
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full bg-gray-200" />
            Not sent yet <b className="font-semibold tabular-nums text-gray-800">{c.queued.toLocaleString("en-IN")}</b>
          </span>
        </div>
      ) : null}
    </div>
  );
}
