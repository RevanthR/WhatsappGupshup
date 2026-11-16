import Link from "next/link";

type AppHealth = {
  id: string;
  keyVerifiedAt: Date | null;
  lastSyncError: string | null;
  lastWebhookAt: Date | null;
  active: boolean;
  approvedCount: number;
};

type Step = { key: string; label: string; ok: boolean; warn?: boolean; href: string; hint: string };

export function readinessSteps(a: AppHealth): Step[] {
  return [
    {
      key: "key",
      label: a.lastSyncError ? "API key problem" : a.keyVerifiedAt ? "Connected to Gupshup" : "Not verified",
      ok: !!a.keyVerifiedAt && !a.lastSyncError,
      warn: !!a.lastSyncError,
      href: `/numbers/${a.id}?tab=settings`,
      hint: "API key and app details accepted by Gupshup",
    },
    {
      key: "templates",
      label: a.approvedCount ? `${a.approvedCount} approved template${a.approvedCount === 1 ? "" : "s"}` : "No approved templates",
      ok: a.approvedCount > 0,
      href: `/numbers/${a.id}?tab=templates`,
      hint: "Templates approved by WhatsApp, synced from Gupshup",
    },
    {
      key: "webhook",
      label: a.lastWebhookAt ? "Webhook connected" : "Webhook not set",
      ok: !!a.lastWebhookAt,
      href: `/numbers/${a.id}?tab=webhook`,
      hint: "Needed for delivery status and customer replies",
    },
  ];
}

export function isReady(a: AppHealth) {
  return readinessSteps(a).every((s) => s.ok);
}

export function ReadinessChips({ app, compact = false }: { app: AppHealth; compact?: boolean }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {!app.active ? <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">Disabled</span> : null}
      {readinessSteps(app).map((s) => (
        <Link
          key={s.key}
          href={s.href}
          title={s.hint}
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium hover:opacity-80 ${
            s.ok ? "bg-emerald-50 text-emerald-700" : s.warn ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-800"
          }`}
        >
          <span aria-hidden>{s.ok ? "✓" : "!"}</span>
          {compact && s.ok ? s.label.replace("Connected to Gupshup", "Gupshup").replace("Webhook connected", "Webhook") : s.label}
        </Link>
      ))}
    </div>
  );
}
