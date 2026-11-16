"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { createTemplateAction, uploadTemplateMediaAction } from "@/app/actions/templates";
import { Alert, Card } from "@/components/ui";
import { TemplatePreview } from "@/components/template-preview";
import { BusyModal } from "@/components/busy-modal";
import { Spinner, toast } from "@/components/toast";
import { maxVar } from "@/lib/template-vars";

type AppOpt = { id: string; name: string; hasAppId: boolean };
type HeaderType = "NONE" | "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT";
type BtnType = "NONE" | "QUICK_REPLY" | "URL" | "PHONE_NUMBER";

const LANGS = [
  ["en", "English"],
  ["en_US", "English (US)"],
  ["en_GB", "English (UK)"],
  ["hi", "Hindi"],
  ["te", "Telugu"],
  ["ta", "Tamil"],
  ["kn", "Kannada"],
  ["ml", "Malayalam"],
  ["mr", "Marathi"],
  ["bn", "Bengali"],
  ["gu", "Gujarati"],
  ["pa", "Punjabi"],
];

const CATEGORIES = [
  ["MARKETING", "Marketing", "Offers, announcements, newsletters, re-engagement."],
  ["UTILITY", "Utility", "Updates on something the customer asked for: orders, bookings, appointments."],
  ["AUTHENTICATION", "Authentication", "One-time passwords and login codes only."],
] as const;

const ACCEPT: Record<string, string> = { IMAGE: "image/jpeg,image/png", VIDEO: "video/mp4", DOCUMENT: "application/pdf" };

const slug = (v: string) => v.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+/, "").slice(0, 60);

function Counter({ n, max }: { n: number; max: number }) {
  return <span className={`text-xs tabular-nums ${n > max ? "text-red-600" : "text-gray-400"}`}>{n}/{max}</span>;
}

export function TemplateBuilder({ apps, initialAppId }: { apps: AppOpt[]; initialAppId?: string }) {
  const [state, action, pending] = useActionState(createTemplateAction, undefined);
  const [appId, setAppId] = useState(apps.find((a) => a.id === initialAppId)?.id ?? apps[0].id);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("MARKETING");
  const [headerType, setHeaderType] = useState<HeaderType>("NONE");
  const [headerText, setHeaderText] = useState("");
  const [headerSample, setHeaderSample] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [body, setBody] = useState("");
  const [samples, setSamples] = useState<string[]>([]);
  const [footer, setFooter] = useState("");
  const [buttons, setButtons] = useState<{ type: BtnType; text: string; value: string }[]>([]);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const app = apps.find((a) => a.id === appId)!;

  useEffect(() => {
    if (state?.error) toast(state.error, "error");
  }, [state]);

  const bodyVars = maxVar(body);
  const headerVars = headerType === "TEXT" ? maxVar(headerText) : 0;

  const addVariable = () => {
    const el = bodyRef.current;
    const token = `{{${bodyVars + 1}}}`;
    if (!el) return setBody((b) => b + token);
    const start = el.selectionStart ?? body.length;
    const end = el.selectionEnd ?? body.length;
    const next = body.slice(0, start) + token + body.slice(end);
    setBody(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    });
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.set("kind", headerType);
    fd.set("file", file);
    const r = await uploadTemplateMediaAction(fd).catch(() => ({ error: "Upload failed. Try again." }) as { url?: string; error?: string });
    setUploading(false);
    if (r.url) {
      setMediaUrl(r.url);
      toast("Sample uploaded.", "success");
    } else toast(r.error ?? "Upload failed.", "error");
  };

  const previewParams = [...(headerVars ? [headerSample || "{{1}}"] : []), ...Array.from({ length: bodyVars }, (_, i) => samples[i] || "")];
  const previewButtons = buttons.filter((b) => b.type !== "NONE").map((b) => ({ type: b.type, text: b.text || "Button" }));
  const isMedia = headerType === "IMAGE" || headerType === "VIDEO" || headerType === "DOCUMENT";

  return (
    <form action={action} className="grid gap-6 lg:grid-cols-5">
      <div className="space-y-6 lg:col-span-3">
        {state?.error ? <Alert tone="error">{state.error}</Alert> : null}

        <Card title="1. Basics">
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="appId">WhatsApp number</label>
                <select id="appId" name="appId" className="input" value={appId} onChange={(e) => setAppId(e.target.value)}>
                  {apps.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
                {!app.hasAppId ? <p className="mt-1 text-xs text-red-700">Add the Gupshup app ID in this number&apos;s Settings first.</p> : null}
              </div>
              <div>
                <label className="label" htmlFor="languageCode">Language</label>
                <select id="languageCode" name="languageCode" className="input" defaultValue="en">
                  {LANGS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
            </div>
            <div>
              <div className="flex items-baseline justify-between">
                <label className="label" htmlFor="elementName">Template name</label>
                <Counter n={name.length} max={60} />
              </div>
              <input
                id="elementName"
                name="elementName"
                required
                value={name}
                onChange={(e) => setName(slug(e.target.value))}
                className="input font-mono"
                placeholder="diwali_offer_2026"
              />
              <p className="hint">Only you see this. Lowercase, numbers and underscores. Spaces become underscores.</p>
            </div>
            <fieldset>
              <legend className="label">Category</legend>
              <div className="grid gap-2 sm:grid-cols-3">
                {CATEGORIES.map(([v, l, d]) => (
                  <label key={v} className={`cursor-pointer rounded-lg border p-3 text-sm ${category === v ? "border-brand-500 bg-brand-50" : "border-gray-200 hover:bg-gray-50"}`}>
                    <span className="flex items-center gap-2 font-medium text-gray-900">
                      <input type="radio" name="category" value={v} checked={category === v} onChange={() => setCategory(v)} className="accent-brand-600" />
                      {l}
                    </span>
                    <span className="mt-1 block text-xs text-gray-500">{d}</span>
                  </label>
                ))}
              </div>
              <label className="mt-3 flex items-start gap-2 text-sm text-gray-700">
                <input type="checkbox" name="allowCategoryChange" defaultChecked className="mt-0.5 h-4 w-4 accent-brand-600" />
                <span>Let WhatsApp change the category if it disagrees. Recommended: otherwise it rejects the template instead.</span>
              </label>
            </fieldset>
          </div>
        </Card>

        <Card title="2. Header (optional)">
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {(["NONE", "TEXT", "IMAGE", "VIDEO", "DOCUMENT"] as HeaderType[]).map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => {
                    setHeaderType(h);
                    setMediaUrl("");
                  }}
                  className={`rounded-full px-3 py-1.5 text-sm ${headerType === h ? "bg-brand-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
                >
                  {h === "NONE" ? "None" : h.charAt(0) + h.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
            <input type="hidden" name="headerType" value={headerType} />
            {headerType === "TEXT" ? (
              <div className="space-y-3">
                <div>
                  <div className="flex items-baseline justify-between">
                    <label className="label" htmlFor="headerText">Header text</label>
                    <Counter n={headerText.length} max={60} />
                  </div>
                  <input id="headerText" name="headerText" value={headerText} onChange={(e) => setHeaderText(e.target.value)} className="input" placeholder="Your order update" />
                  <p className="hint">Bold line at the top. One variable allowed: {"{{1}}"}.</p>
                </div>
                {headerVars ? (
                  <div>
                    <label className="label" htmlFor="headerSample">Sample for header {"{{1}}"}</label>
                    <input id="headerSample" name="headerSample" value={headerSample} onChange={(e) => setHeaderSample(e.target.value)} className="input" />
                  </div>
                ) : null}
              </div>
            ) : null}
            {isMedia ? (
              <div className="space-y-2">
                <p className="text-sm text-gray-600">
                  Upload a sample {headerType.toLowerCase()} for WhatsApp&apos;s reviewers. When sending, you can use this one or a different one per message.
                </p>
                <div className="flex flex-wrap items-center gap-3">
                  <label className={`btn-secondary cursor-pointer ${uploading ? "pointer-events-none opacity-60" : ""}`}>
                    {uploading ? <><Spinner /> Uploading...</> : mediaUrl ? "Replace file" : `Upload ${headerType.toLowerCase()}`}
                    <input type="file" accept={ACCEPT[headerType]} className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
                  </label>
                  <span className="text-xs text-gray-500">
                    {headerType === "IMAGE" ? "JPG or PNG, up to 5 MB" : headerType === "VIDEO" ? "MP4, up to 4 MB" : "PDF, up to 4 MB"}
                  </span>
                </div>
                <input type="hidden" name="mediaUrl" value={mediaUrl} />
                {mediaUrl ? <p className="truncate text-xs text-emerald-700">✓ Sample ready</p> : null}
              </div>
            ) : null}
          </div>
        </Card>

        <Card title="3. Message body">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <button type="button" className="btn-secondary px-3 py-1.5 text-xs" onClick={addVariable}>+ Add variable {`{{${bodyVars + 1}}}`}</button>
              <Counter n={body.length} max={1024} />
            </div>
            <textarea
              ref={bodyRef}
              name="body"
              required
              rows={7}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="input"
              placeholder={"Hi {{1}}, your order {{2}} is on the way. Track it anytime from your account."}
            />
            <p className="hint">
              Variables are filled per person when sending, e.g. their name. Use *bold*, _italic_, ~strike~. A variable cannot be the very first or last thing in the message.
            </p>
            {bodyVars ? (
              <div className="rounded-lg bg-gray-50 p-3">
                <p className="mb-2 text-sm font-medium text-gray-800">Sample values (required by WhatsApp)</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {Array.from({ length: bodyVars }, (_, i) => (
                    <div key={i}>
                      <label className="label" htmlFor={`bodySample${i + 1}`}>{`{{${i + 1}}}`}</label>
                      <input
                        id={`bodySample${i + 1}`}
                        name={`bodySample${i + 1}`}
                        value={samples[i] ?? ""}
                        onChange={(e) => setSamples((s) => Object.assign([...s], { [i]: e.target.value }))}
                        className="input"
                        placeholder={i === 0 ? "Asha" : "ORD-1042"}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </Card>

        <Card title="4. Footer and buttons (optional)">
          <div className="space-y-4">
            <div>
              <div className="flex items-baseline justify-between">
                <label className="label" htmlFor="footer">Footer</label>
                <Counter n={footer.length} max={60} />
              </div>
              <input id="footer" name="footer" value={footer} onChange={(e) => setFooter(e.target.value)} className="input" placeholder="Reply STOP to unsubscribe" />
            </div>
            <div className="space-y-3">
              {buttons.map((b, i) => (
                <div key={i} className="grid gap-2 rounded-lg border border-gray-200 p-3 sm:grid-cols-[10rem_1fr_1fr_auto] sm:items-end">
                  <div>
                    <label className="label" htmlFor={`btnType${i}`}>Button {i + 1}</label>
                    <select
                      id={`btnType${i}`}
                      name={`btnType${i}`}
                      value={b.type}
                      onChange={(e) => setButtons((s) => s.map((x, j) => (j === i ? { ...x, type: e.target.value as BtnType } : x)))}
                      className="input"
                    >
                      <option value="QUICK_REPLY">Quick reply</option>
                      <option value="URL">Website link</option>
                      <option value="PHONE_NUMBER">Call number</option>
                    </select>
                  </div>
                  <div>
                    <label className="label" htmlFor={`btnText${i}`}>Label</label>
                    <input
                      id={`btnText${i}`}
                      name={`btnText${i}`}
                      maxLength={25}
                      value={b.text}
                      onChange={(e) => setButtons((s) => s.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))}
                      className="input"
                      placeholder={b.type === "URL" ? "Visit website" : b.type === "PHONE_NUMBER" ? "Call us" : "Yes, interested"}
                    />
                  </div>
                  <div>
                    {b.type !== "QUICK_REPLY" ? (
                      <>
                        <label className="label" htmlFor={`btnValue${i}`}>{b.type === "URL" ? "Link" : "Phone"}</label>
                        <input
                          id={`btnValue${i}`}
                          name={`btnValue${i}`}
                          value={b.value}
                          onChange={(e) => setButtons((s) => s.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))}
                          className="input"
                          placeholder={b.type === "URL" ? "https://..." : "+91 98765 43210"}
                        />
                      </>
                    ) : null}
                  </div>
                  <button type="button" className="btn-ghost text-red-700" onClick={() => setButtons((s) => s.filter((_, j) => j !== i))}>Remove</button>
                </div>
              ))}
              {buttons.length < 3 ? (
                <button type="button" className="btn-secondary px-3 py-1.5 text-xs" onClick={() => setButtons((s) => [...s, { type: "QUICK_REPLY", text: "", value: "" }])}>
                  + Add button
                </button>
              ) : null}
            </div>
          </div>
        </Card>

        <div className="flex flex-wrap items-center gap-3">
          <button className="btn-primary" disabled={pending || uploading || !app.hasAppId || (isMedia && !mediaUrl)}>
            {pending ? <><Spinner /> Submitting...</> : "Submit for WhatsApp approval"}
          </button>
          <p className="text-xs text-gray-500">Review usually takes a few minutes to a few hours. Status updates here automatically.</p>
        </div>
        <BusyModal open={pending} title="Submitting template" steps={["Checking the template", "Sending to Gupshup", "Queued for WhatsApp review"]} />
      </div>

      <div className="lg:col-span-2">
        <div className="lg:sticky lg:top-6">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">Preview with sample values</p>
          <TemplatePreview
            template={{
              body: body || "Your message appears here.",
              header: headerType === "TEXT" ? headerText || null : null,
              footer: footer || null,
              templateType: isMedia ? headerType : "TEXT",
              sampleMediaUrl: mediaUrl || null,
              buttons: previewButtons,
            }}
            params={previewParams}
          />
        </div>
      </div>
    </form>
  );
}
