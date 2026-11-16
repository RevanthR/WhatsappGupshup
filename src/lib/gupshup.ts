import "server-only";
import { maxVar } from "@/lib/template-vars";

// Override only for local testing against a mock server.
const BASE = process.env.GUPSHUP_BASE_URL || "https://api.gupshup.io";

export type GupshupCreds = {
  apiKey: string;
  appName: string; // src.name
  source: string; // sender number, digits with country code
};

export type SendResult =
  | { ok: true; messageId: string }
  | { ok: false; error: string; retryable: boolean };

async function postForm(path: string, apiKey: string, form: Record<string, string>): Promise<SendResult> {
  let res: Response;
  try {
    res = await fetch(BASE + path, {
      method: "POST",
      headers: {
        apikey: apiKey,
        "Content-Type": "application/x-www-form-urlencoded",
        "Cache-Control": "no-cache",
      },
      body: new URLSearchParams(form).toString(),
      signal: AbortSignal.timeout(15_000),
    });
  } catch (e) {
    return { ok: false, error: `Network error: ${(e as Error).message}`, retryable: true };
  }
  const text = await res.text();
  let json: Record<string, unknown> | null = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* not JSON */
  }
  if (res.ok && json && json.status === "submitted" && typeof json.messageId === "string") {
    return { ok: true, messageId: json.messageId };
  }
  const message =
    (json && (typeof json.message === "string" ? json.message : JSON.stringify(json))) || text || res.statusText;
  // 429 and 5xx are worth retrying, everything else is a request problem.
  const retryable = res.status === 429 || res.status >= 500;
  return { ok: false, error: `Gupshup ${res.status}: ${message}`.slice(0, 500), retryable };
}

export type MediaHeader = { type: "image" | "video" | "document"; url: string; filename?: string };

export function sendTemplate(
  creds: GupshupCreds,
  destination: string,
  templateId: string,
  params: string[],
  media?: MediaHeader,
): Promise<SendResult> {
  const form: Record<string, string> = {
    channel: "whatsapp",
    source: creds.source,
    destination,
    "src.name": creds.appName,
    template: JSON.stringify({ id: templateId, params }),
  };
  if (media) {
    const inner: Record<string, string> = { link: media.url };
    if (media.type === "document" && media.filename) inner.filename = media.filename;
    form.message = JSON.stringify({ type: media.type, [media.type]: inner });
  }
  return postForm("/wa/api/v1/template/msg", creds.apiKey, form);
}

export function sendText(creds: GupshupCreds, destination: string, text: string): Promise<SendResult> {
  return postForm("/wa/api/v1/msg", creds.apiKey, {
    channel: "whatsapp",
    source: creds.source,
    destination,
    "src.name": creds.appName,
    message: JSON.stringify({ type: "text", text }),
  });
}

export type RemoteTemplate = {
  id: string;
  elementName: string;
  languageCode: string;
  category: string | null;
  status: string;
  templateType: string;
  body: string;
  header: string | null;
  footer: string | null;
  buttons: unknown;
  paramCount: number;
  sampleMediaUrl: string | null;
  reason: string | null;
  raw: unknown;
};


function parseJson(v: unknown): Record<string, unknown> | null {
  if (typeof v !== "string") return v && typeof v === "object" ? (v as Record<string, unknown>) : null;
  try {
    return JSON.parse(v);
  } catch {
    return null;
  }
}

async function fetchTemplates(url: string, apiKey: string): Promise<Record<string, unknown>[]> {
  const res = await fetch(url, {
    headers: { apikey: apiKey },
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  const text = await res.text();
  let json: { status?: string; message?: string; templates?: Record<string, unknown>[] } = {};
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`Gupshup ${res.status}: ${text.slice(0, 200)}`);
  }
  if (!res.ok || json.status !== "success") {
    throw new Error(`Gupshup ${res.status}: ${json.message ?? text.slice(0, 200)}`);
  }
  return json.templates ?? [];
}

// Newer Gupshup dashboards issue app-level API keys, which only work on the
// app-scoped endpoint (needs the app ID). Older account-level keys work on
// the /sm endpoint (needs the app name). Try app-scoped first, then fall back.
export async function listTemplates(apiKey: string, appName: string, appId?: string | null): Promise<RemoteTemplate[]> {
  const errors: string[] = [];
  let rows: Record<string, unknown>[] | null = null;
  if (appId) {
    try {
      rows = await fetchTemplates(`${BASE}/wa/app/${encodeURIComponent(appId)}/template`, apiKey);
    } catch (e) {
      errors.push(`app ID endpoint: ${(e as Error).message}`);
    }
  }
  if (!rows) {
    try {
      rows = await fetchTemplates(`${BASE}/sm/api/v1/template/list/${encodeURIComponent(appName)}`, apiKey);
    } catch (e) {
      errors.push(`app name endpoint: ${(e as Error).message}`);
    }
  }
  if (!rows) {
    if (!appId) errors.push("Tip: add the Gupshup app ID in Settings. App-level API keys need it.");
    throw new Error(errors.join(" | "));
  }
  return rows.map(parseRemoteTemplate);
}

export type NewTemplate = {
  elementName: string;
  languageCode: string;
  category: "MARKETING" | "UTILITY" | "AUTHENTICATION";
  templateType: "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT";
  vertical: string;
  content: string;
  example: string;
  header?: string;
  exampleHeader?: string;
  footer?: string;
  buttons?: { type: "QUICK_REPLY" | "URL" | "PHONE_NUMBER"; text: string; url?: string; phone_number?: string }[];
  mediaUrl?: string;
  allowTemplateCategoryChange: boolean;
};

// Submits a template for WhatsApp approval. Works with app-level API keys on
// api.gupshup.io (tested). Media samples go as a public mediaUrl, which Gupshup
// fetches itself; its upload endpoint returns a message media ID that Meta
// rejects as a template sample.
export async function createTemplate(
  apiKey: string,
  appId: string,
  t: NewTemplate,
): Promise<{ ok: true; template: Record<string, unknown> } | { ok: false; error: string }> {
  const form: Record<string, string> = {
    elementName: t.elementName,
    languageCode: t.languageCode,
    category: t.category,
    templateType: t.templateType,
    vertical: t.vertical,
    content: t.content,
    example: t.example,
    enableSample: "true",
    allowTemplateCategoryChange: String(t.allowTemplateCategoryChange),
  };
  if (t.header) form.header = t.header;
  if (t.exampleHeader) form.exampleHeader = t.exampleHeader;
  if (t.footer) form.footer = t.footer;
  if (t.buttons?.length) form.buttons = JSON.stringify(t.buttons);
  if (t.mediaUrl) form.mediaUrl = t.mediaUrl;
  let res: Response;
  try {
    res = await fetch(`${BASE}/wa/app/${encodeURIComponent(appId)}/template`, {
      method: "POST",
      headers: { apikey: apiKey, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(form).toString(),
      signal: AbortSignal.timeout(30_000),
    });
  } catch (e) {
    return { ok: false, error: `Network error: ${(e as Error).message}` };
  }
  const text = await res.text();
  let json: { status?: string; message?: unknown; template?: Record<string, unknown> } = {};
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, error: `Gupshup ${res.status}: ${text.slice(0, 300)}` };
  }
  if (res.ok && json.status === "success" && json.template) return { ok: true, template: json.template };
  const msg = typeof json.message === "string" ? json.message : JSON.stringify(json.message ?? json);
  return { ok: false, error: `Gupshup ${res.status}: ${msg}`.slice(0, 500) };
}

// Maps one raw Gupshup template object to our shape (shared by list and create).
export function parseRemoteTemplate(t: Record<string, unknown>): RemoteTemplate {
  const container = parseJson(t.containerMeta) ?? {};
  const body = String(container.data ?? t.data ?? "");
  const header = typeof container.header === "string" ? container.header : null;
  const footer = typeof container.footer === "string" ? container.footer : null;
  const meta = parseJson(t.meta) ?? {};
  const mediaUrl = (typeof meta.mediaUrl === "string" && meta.mediaUrl) || (typeof container.mediaUrl === "string" && container.mediaUrl) || "";
  return {
    id: String(t.id),
    elementName: String(t.elementName ?? t.id),
    languageCode: String(t.languageCode ?? "en"),
    category: t.category ? String(t.category) : null,
    status: String(t.status ?? "UNKNOWN").toUpperCase(),
    templateType: String(t.templateType ?? "TEXT").toUpperCase(),
    body,
    header,
    footer,
    buttons: container.buttons ?? null,
    paramCount: maxVar(header) + maxVar(body),
    sampleMediaUrl: /^https?:\/\//.test(mediaUrl) ? mediaUrl : null,
    reason: typeof t.reason === "string" && t.reason ? t.reason : null,
    raw: t,
  };
}
