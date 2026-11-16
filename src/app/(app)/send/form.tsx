"use client";

import { useActionState, useState } from "react";
import { sendSingleAction } from "@/app/actions/send";
import { Alert, Card } from "@/components/ui";
import { Spinner } from "@/components/toast";
import { useResultToast } from "@/components/action-form";
import { TemplatePreview, type PreviewTemplate } from "@/components/template-preview";
import { varLabels } from "@/lib/template-vars";

type Tpl = PreviewTemplate & { id: string; elementName: string; languageCode: string; paramCount: number };
type AppOpt = { id: string; name: string; account: { name: string }; templates: Tpl[] };

export function SendForm({ apps, initialAppId, initialPhone }: { apps: AppOpt[]; initialAppId?: string; initialPhone?: string }) {
  const [appId, setAppId] = useState(apps.find((a) => a.id === initialAppId)?.id ?? apps[0].id);
  const app = apps.find((a) => a.id === appId)!;
  const [templateId, setTemplateId] = useState(app.templates[0]?.id ?? "");
  const template = app.templates.find((t) => t.id === templateId);
  const [values, setValues] = useState<Record<string, string>>({});
  const [mediaUrl, setMediaUrl] = useState("");
  const [state, action, pending] = useActionState(sendSingleAction, undefined);
  useResultToast(state);

  const params = Array.from({ length: template?.paramCount ?? 0 }, (_, i) => values[`p${i + 1}`] ?? "");
  const labels = template ? varLabels(template) : [];
  const needsMedia = template && ["IMAGE", "VIDEO", "DOCUMENT"].includes(template.templateType);

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <Card className="lg:col-span-3">
        <form action={action} className="space-y-4">
          {state?.error ? <Alert tone="error">{state.error}</Alert> : null}
          {state?.ok ? <Alert tone="success">{state.ok}</Alert> : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="appId">App</label>
              <select
                id="appId"
                name="appId"
                className="input"
                value={appId}
                onChange={(e) => {
                  const next = apps.find((a) => a.id === e.target.value)!;
                  setAppId(next.id);
                  setTemplateId(next.templates[0]?.id ?? "");
                  setValues({});
                }}
              >
                {apps.map((a) => (
                  <option key={a.id} value={a.id}>{a.account.name} / {a.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="templateId">Template</label>
              <select
                id="templateId"
                name="templateId"
                className="input"
                value={templateId}
                onChange={(e) => {
                  setTemplateId(e.target.value);
                  setValues({});
                }}
              >
                {app.templates.length === 0 ? <option value="">No approved templates</option> : null}
                {app.templates.map((t) => (
                  <option key={t.id} value={t.id}>{t.elementName} ({t.languageCode})</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="label" htmlFor="phone">Phone number</label>
            <input id="phone" name="phone" required className="input" inputMode="tel" placeholder="+91 98765 43210" defaultValue={initialPhone} />
            <p className="hint">Numbers without a country code are treated as Indian.</p>
          </div>

          {needsMedia ? (
            <div>
              <label className="label" htmlFor="mediaUrl">
                {template!.templateType.toLowerCase()} URL {template!.sampleMediaUrl ? "(optional)" : ""}
              </label>
              <input
                id="mediaUrl"
                name="mediaUrl"
                type="url"
                required={!template!.sampleMediaUrl}
                className="input"
                placeholder={template!.sampleMediaUrl ? "Leave blank to use the one saved in Gupshup" : "https://..."}
                value={mediaUrl}
                onChange={(e) => setMediaUrl(e.target.value)}
              />
              <p className="hint">
                {template!.sampleMediaUrl
                  ? `Uses the ${template!.templateType.toLowerCase()} uploaded with this template in Gupshup. Paste a public link only to send a different one.`
                  : "Must be a public link WhatsApp can download."}
              </p>
            </div>
          ) : null}

          {template && template.paramCount > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {params.map((v, i) => (
                <div key={`${templateId}-${i}`}>
                  <label className="label" htmlFor={`p${i + 1}`}>{labels[i] ?? `var${i + 1}`}</label>
                  <input
                    id={`p${i + 1}`}
                    name={`p${i + 1}`}
                    required
                    className="input"
                    value={v}
                    onChange={(e) => setValues((s) => ({ ...s, [`p${i + 1}`]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
          ) : null}

          <button className="btn-primary w-full sm:w-auto" disabled={pending || !template}>
            {pending ? <><Spinner /> Sending to WhatsApp...</> : "Send message"}
          </button>
        </form>
      </Card>

      <div className="lg:col-span-2">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">Preview</p>
        {template ? <TemplatePreview template={template} params={params} mediaUrl={mediaUrl} /> : <p className="text-sm text-gray-500">Pick a template.</p>}
      </div>
    </div>
  );
}
