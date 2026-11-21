import { categoryLabel, isMediaType, typeLabel } from "@/lib/template-label";

const TYPE_CLS: Record<string, string> = {
  TEXT: "bg-gray-100 text-gray-700",
  IMAGE: "bg-sky-50 text-sky-700",
  VIDEO: "bg-violet-50 text-violet-700",
  DOCUMENT: "bg-amber-50 text-amber-700",
};
const CAT_CLS: Record<string, string> = {
  MARKETING: "bg-pink-50 text-pink-700",
  UTILITY: "bg-emerald-50 text-emerald-700",
  AUTHENTICATION: "bg-blue-50 text-blue-700",
};

// Chips for type and category, plus one line on what sending this template needs.
export function TemplateTypeInfo({ t, mode }: { t: { templateType: string; category?: string | null; paramCount: number; sampleMediaUrl?: string | null }; mode: "bulk" | "single" }) {
  const media = isMediaType(t.templateType);
  const kind = typeLabel(t.templateType).toLowerCase();
  const needs = [
    t.paramCount ? `${t.paramCount} variable${t.paramCount === 1 ? "" : "s"}` : "no variables",
    media ? (t.sampleMediaUrl ? `uses the saved ${kind} unless you give another${mode === "bulk" ? " in media_url" : ""}` : `needs a ${kind} link${mode === "bulk" ? " in media_url for every row" : ""}`) : null,
  ].filter(Boolean).join(", ");
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
      <span className={`rounded-full px-2 py-0.5 font-medium ${TYPE_CLS[t.templateType] ?? "bg-gray-100 text-gray-700"}`}>{typeLabel(t.templateType)}</span>
      {t.category ? <span className={`rounded-full px-2 py-0.5 font-medium ${CAT_CLS[t.category] ?? "bg-gray-100 text-gray-700"}`}>{categoryLabel(t.category)}</span> : null}
      <span className="text-gray-500">{needs.charAt(0).toUpperCase() + needs.slice(1)}.</span>
      {t.category === "MARKETING" ? <span className="basis-full text-gray-500">WhatsApp limits how many marketing messages one person gets, so some may fail with a cap error.</span> : null}
    </div>
  );
}
