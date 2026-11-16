import Link from "next/link";
import { Badge } from "@/components/ui";
import { TemplatePreview } from "@/components/template-preview";
import { varLabels } from "@/lib/template-vars";

type T = {
  id: string;
  appId: string;
  elementName: string;
  languageCode: string;
  category: string | null;
  status: string;
  templateType: string;
  body: string;
  header: string | null;
  footer: string | null;
  sampleMediaUrl: string | null;
  paramCount: number;
  buttons?: unknown;
  reason?: string | null;
};

const STATUS_HELP: Record<string, string> = {
  APPROVED: "Ready to send",
  PENDING: "Waiting for WhatsApp approval",
  REJECTED: "Rejected by WhatsApp. Fix it in Gupshup.",
  FAILED: "Submission failed in Gupshup",
  PAUSED: "Paused by Meta for low quality",
  DISABLED: "Disabled by Meta",
  DELETED: "Deleted in Gupshup",
};

export function TemplateCard({ t, numberName }: { t: T; numberName?: string }) {
  const ok = t.status === "APPROVED";
  const vars = varLabels(t);
  return (
    <div className={`card flex flex-col overflow-hidden ${ok ? "" : "opacity-80"}`}>
      <div className="flex items-start justify-between gap-2 px-4 pt-4">
        <div className="min-w-0">
          <p className="truncate font-mono text-sm font-semibold text-gray-900" title={t.elementName}>{t.elementName}</p>
          <p className="mt-0.5 text-xs text-gray-500">
            {numberName ? `${numberName} · ` : ""}
            {t.category ? t.category.charAt(0) + t.category.slice(1).toLowerCase() : "Template"} · {t.languageCode}
            {t.templateType !== "TEXT" ? ` · ${t.templateType.toLowerCase()}` : ""}
          </p>
        </div>
        <span title={STATUS_HELP[t.status] ?? t.status}>
          <Badge value={t.status} />
        </span>
      </div>
      <div className="flex-1 px-4 py-3">
        <div className="max-h-72 overflow-hidden rounded-xl">
          <TemplatePreview template={t} params={[]} />
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 px-4 py-3">
        <span className="text-xs text-gray-500">
          {vars.length ? `${vars.length} variable${vars.length === 1 ? "" : "s"}: ${vars.join(", ")}` : "No variables"}
        </span>
        {ok ? (
          <div className="flex gap-2">
            <Link href={`/send?app=${t.appId}&template=${t.id}`} className="btn-secondary px-3 py-1.5 text-xs">Send one</Link>
            <Link href={`/bulk?app=${t.appId}&template=${t.id}`} className="btn-primary px-3 py-1.5 text-xs">Bulk send</Link>
          </div>
        ) : (
          <span className="text-xs text-gray-500">{t.reason ? `${STATUS_HELP[t.status] ?? t.status}: ${t.reason}` : STATUS_HELP[t.status] ?? "Not sendable"}</span>
        )}
      </div>
    </div>
  );
}
