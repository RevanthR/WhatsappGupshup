// WhatsApp numbers header and body variables separately ({{1}} in each).
// Gupshup takes one params array: header variables first, then body variables.

export function maxVar(text: string | null | undefined): number {
  let max = 0;
  for (const m of (text ?? "").matchAll(/\{\{\s*(\d+)\s*\}\}/g)) max = Math.max(max, Number(m[1]));
  return max;
}

export function varLabels(t: { header: string | null; body: string }): string[] {
  const h = maxVar(t.header);
  const b = maxVar(t.body);
  return [
    ...Array.from({ length: h }, (_, i) => `header_${i + 1}`),
    ...Array.from({ length: b }, (_, i) => (h ? `body_${i + 1}` : `var${i + 1}`)),
  ];
}

export function fillText(text: string, params: string[]): string {
  return text.replace(/\{\{\s*(\d+)\s*\}\}/g, (m, n) => params[Number(n) - 1] ?? m);
}

export function splitParams(t: { header: string | null }, params: string[]) {
  const h = maxVar(t.header);
  return { header: params.slice(0, h), body: params.slice(h) };
}

export function renderPreviewText(t: { header: string | null; body: string }, params: string[]): string {
  const { header, body } = splitParams(t, params);
  return [t.header ? fillText(t.header, header) : "", fillText(t.body, body)].filter(Boolean).join("\n");
}
