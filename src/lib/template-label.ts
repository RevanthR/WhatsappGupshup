// Plain labels for a template's type and category, used in pickers and chips.
const TYPE: Record<string, string> = { TEXT: "Text", IMAGE: "Image", VIDEO: "Video", DOCUMENT: "Document", LOCATION: "Location", CAROUSEL: "Carousel" };
const cap = (s: string) => s.charAt(0) + s.slice(1).toLowerCase();

export const typeLabel = (t: string) => TYPE[t] ?? cap(t);
export const categoryLabel = (c: string | null | undefined) => (c ? cap(c) : "");
export const isMediaType = (t: string) => ["IMAGE", "VIDEO", "DOCUMENT"].includes(t);

export function templateOption(t: { elementName: string; languageCode: string; templateType: string; category?: string | null }) {
  return [t.elementName, typeLabel(t.templateType), categoryLabel(t.category), t.languageCode].filter(Boolean).join(" · ");
}
