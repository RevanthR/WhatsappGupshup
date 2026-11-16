import "server-only";
import ExcelJS from "exceljs";
import { varLabels } from "@/lib/template-vars";
import { normalizePhone } from "@/lib/phone";
import type { Template } from "@/generated/prisma/client";

type Tpl = Pick<Template, "elementName" | "body" | "header" | "footer" | "templateType" | "paramCount"> & {
  sampleMediaUrl?: string | null;
};

export function columnsFor(t: Tpl): string[] {
  const media = ["IMAGE", "VIDEO", "DOCUMENT"].includes(t.templateType);
  return ["phone", ...(media ? ["media_url"] : []), ...varLabels(t)];
}

export async function buildTemplateWorkbook(t: Tpl): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const cols = columnsFor(t);
  const ws = wb.addWorksheet("Recipients");
  ws.columns = cols.map((c) => ({ header: c, key: c, width: c === "phone" ? 18 : c === "media_url" ? 40 : 24 }));
  ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF15803D" } };
  ws.views = [{ state: "frozen", ySplit: 1 }];
  // Phone column as text so Excel does not mangle long numbers.
  ws.getColumn(1).numFmt = "@";
  ws.addRow(Object.fromEntries(cols.map((c) => [c, c === "phone" ? "919876543210" : c === "media_url" ? (t.sampleMediaUrl ? "" : "https://example.com/file.jpg") : `sample ${c}`])));

  const info = wb.addWorksheet("How to fill");
  info.getColumn(1).width = 100;
  const lines = [
    `Template: ${t.elementName}`,
    "",
    "1. Fill one row per recipient on the Recipients sheet. Delete the sample row.",
    "2. phone: number with country code, e.g. 919876543210 or +91 98765 43210. 10-digit numbers are treated as Indian.",
    ...(cols.includes("media_url")
      ? [
          t.sampleMediaUrl
            ? `3. media_url: optional. Leave blank to send the ${t.templateType.toLowerCase()} saved with this template in Gupshup, or paste a public link to send a different one for that row.`
            : `3. media_url: public link to the ${t.templateType.toLowerCase()} for this row.`,
        ]
      : []),
    "Variables fill the placeholders in order:",
    ...varLabels(t).map((l) => `   ${l}`),
    "",
    "Template text:",
    ...(t.header ? [`Header: ${t.header}`] : []),
    t.body,
    ...(t.footer ? [`Footer: ${t.footer}`] : []),
    "",
    "Do not rename or reorder the column headers.",
  ];
  lines.forEach((l) => info.addRow([l]));
  info.getRow(1).font = { bold: true };

  return Buffer.from(await wb.xlsx.writeBuffer());
}

export type ParsedRow = { row: number; phone: string; params: string[]; mediaUrl: string | null };
export type BadRow = { row: number; raw: string; reason: string };

function cellText(v: ExcelJS.CellValue): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "object") {
    if ("text" in v && typeof v.text === "string") return v.text; // hyperlink
    if ("result" in v) return v.result == null ? "" : String(v.result); // formula
    if ("richText" in v) return v.richText.map((r) => r.text).join("");
    if (v instanceof Date) return v.toISOString().slice(0, 10);
  }
  if (typeof v === "number") return Number.isInteger(v) ? v.toFixed(0) : String(v);
  return String(v).trim();
}

export async function parseRecipients(file: ArrayBuffer, t: Tpl, maxRows = 50_000) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(file);
  const ws = wb.getWorksheet("Recipients") ?? wb.worksheets[0];
  if (!ws) throw new Error("The file has no sheets.");

  const expected = columnsFor(t);
  const header = (ws.getRow(1).values as ExcelJS.CellValue[]).slice(1).map((v) => cellText(v).toLowerCase().trim());
  const index: Record<string, number> = {};
  for (const col of expected) {
    const i = header.indexOf(col);
    if (i === -1 && col === "media_url" && t.sampleMediaUrl) continue;
    if (i === -1) throw new Error(`Column "${col}" is missing. Download the Excel template for this template and use it as is.`);
    index[col] = i + 1;
  }

  const good: ParsedRow[] = [];
  const bad: BadRow[] = [];
  const seen = new Map<string, number>();
  const labels = varLabels(t);
  let overLimit = false;

  ws.eachRow({ includeEmpty: false }, (row, n) => {
    if (n === 1) return;
    const get = (col: string) => (index[col] ? cellText(row.getCell(index[col]).value) : "");
    const rawPhone = get("phone");
    const values = expected.map(get);
    if (values.every((v) => !v)) return;
    if (good.length + bad.length >= maxRows) {
      overLimit = true;
      return;
    }
    const phone = normalizePhone(rawPhone);
    if (!phone) return void bad.push({ row: n, raw: rawPhone, reason: "Invalid phone number" });
    if (seen.has(phone)) return void bad.push({ row: n, raw: rawPhone, reason: `Duplicate of row ${seen.get(phone)}` });
    const params = labels.map(get);
    const missing = labels.filter((_, i) => !params[i]);
    if (missing.length) return void bad.push({ row: n, raw: rawPhone, reason: `Empty: ${missing.join(", ")}` });
    let mediaUrl: string | null = null;
    if (index.media_url) {
      mediaUrl = get("media_url") || null;
      if (mediaUrl && !/^https?:\/\/\S+$/.test(mediaUrl)) return void bad.push({ row: n, raw: rawPhone, reason: "media_url must be a public http(s) link" });
      if (!mediaUrl && !t.sampleMediaUrl) return void bad.push({ row: n, raw: rawPhone, reason: "media_url is required (no media saved with this template)" });
    }
    seen.set(phone, n);
    good.push({ row: n, phone, params, mediaUrl });
  });

  return { good, bad, overLimit };
}

export async function buildResultsWorkbook(
  t: Tpl,
  rows: { rowNumber: number | null; phone: string; params: unknown; mediaUrl: string | null; status: string; error: string | null; submittedAt: Date | null; deliveredAt: Date | null; readAt: Date | null }[],
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Results");
  const labels = varLabels(t);
  const media = ["IMAGE", "VIDEO", "DOCUMENT"].includes(t.templateType);
  ws.columns = [
    { header: "row", key: "row", width: 6 },
    { header: "phone", key: "phone", width: 16 },
    ...(media ? [{ header: "media_url", key: "media_url", width: 30 }] : []),
    ...labels.map((l) => ({ header: l, key: l, width: 20 })),
    { header: "status", key: "status", width: 12 },
    { header: "error", key: "error", width: 40 },
    { header: "submitted_at", key: "submitted", width: 20 },
    { header: "delivered_at", key: "delivered", width: 20 },
    { header: "read_at", key: "read", width: 20 },
  ];
  ws.getRow(1).font = { bold: true };
  for (const r of rows) {
    const params = Array.isArray(r.params) ? (r.params as string[]) : [];
    ws.addRow({
      row: r.rowNumber,
      phone: r.phone,
      media_url: r.mediaUrl,
      ...Object.fromEntries(labels.map((l, i) => [l, params[i] ?? ""])),
      status: r.status,
      error: r.error ?? "",
      submitted: r.submittedAt,
      delivered: r.deliveredAt,
      read: r.readAt,
    });
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}
