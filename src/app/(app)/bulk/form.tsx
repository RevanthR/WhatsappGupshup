"use client";

import { useActionState, useEffect, useState } from "react";
import { uploadBulkAction } from "@/app/actions/campaigns";
import { Alert, Card } from "@/components/ui";
import { TemplatePreview, type PreviewTemplate } from "@/components/template-preview";
import { varLabels } from "@/lib/template-vars";
import { BusyModal } from "@/components/busy-modal";
import { Spinner, toast } from "@/components/toast";

type Tpl = PreviewTemplate & { id: string; elementName: string; languageCode: string; paramCount: number };
type AppOpt = { id: string; name: string; account: { name: string }; templates: Tpl[] };

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 sm:gap-4">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-600 text-sm font-semibold text-white">{n}</span>
      <div className="min-w-0 flex-1 pb-2">
        <p className="mb-3 font-medium text-gray-900">{title}</p>
        {children}
      </div>
    </div>
  );
}

export function BulkForm({ apps, initialAppId }: { apps: AppOpt[]; initialAppId?: string }) {
  const [appId, setAppId] = useState(apps.find((a) => a.id === initialAppId)?.id ?? apps[0].id);
  const app = apps.find((a) => a.id === appId)!;
  const [templateId, setTemplateId] = useState(app.templates[0]?.id ?? "");
  const template = app.templates.find((t) => t.id === templateId);
  const [state, action, pending] = useActionState(uploadBulkAction, undefined);
  const [fileName, setFileName] = useState("");
  useEffect(() => {
    if (state?.error) toast(state.bad?.length ? `${state.error} ${state.bad.length} row(s) have problems.` : state.error, "error");
  }, [state]);
  const media = template && ["IMAGE", "VIDEO", "DOCUMENT"].includes(template.templateType);
  const cols = template ? ["phone", ...(media ? ["media_url"] : []), ...varLabels(template)] : [];

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <Card className="lg:col-span-3">
        <form action={action} className="space-y-6">
          <Step n={1} title="Choose app and template">
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
                  }}
                >
                  {apps.map((a) => (
                    <option key={a.id} value={a.id}>{a.account.name} / {a.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="templateId">Template</label>
                <select id="templateId" name="templateId" className="input" value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
                  {app.templates.length === 0 ? <option value="">No approved templates</option> : null}
                  {app.templates.map((t) => (
                    <option key={t.id} value={t.id}>{t.elementName} ({t.languageCode})</option>
                  ))}
                </select>
              </div>
            </div>
          </Step>

          <Step n={2} title="Download the Excel template and fill it">
            {template ? (
              <>
                <p className="mb-3 text-sm text-gray-600">
                  Columns:{" "}
                  {cols.map((c) => (
                    <code key={c} className="mr-1 inline-block rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-800">{c}</code>
                  ))}
                </p>
                <a href={`/api/templates/${template.id}/excel`} className="btn-secondary">Download Excel template</a>
              </>
            ) : (
              <p className="text-sm text-gray-500">Pick a template first.</p>
            )}
          </Step>

          <Step n={3} title="Upload the filled file">
            <div className="space-y-4">
              <div>
                <label className="label" htmlFor="name">Campaign name (optional)</label>
                <input id="name" name="name" className="input" placeholder={template ? `${template.elementName} ${new Date().toLocaleDateString("en-IN")}` : ""} />
              </div>
              <div>
                <label className="label" htmlFor="file">Excel file (.xlsx)</label>
                <input
                  id="file"
                  name="file"
                  type="file"
                  required
                  accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  onChange={(e) => setFileName(e.target.files?.[0]?.name ?? "")}
                  className="block w-full text-sm text-gray-700 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-brand-700 hover:file:bg-brand-100"
                />
                <p className="hint">Up to 4 MB (about 50,000 rows). Nothing is sent yet. You review the rows first.</p>
              </div>
              {state?.error ? <Alert tone="error">{state.error}</Alert> : null}
              {state?.bad?.length ? <BadRows rows={state.bad} /> : null}
              <button className="btn-primary w-full sm:w-auto" disabled={pending || !template}>
                {pending ? <><Spinner /> Checking rows...</> : "Upload and review"}
              </button>
            </div>
          </Step>
        </form>
        <BusyModal
          open={pending}
          title={fileName ? `Processing ${fileName}` : "Processing file"}
          steps={["Uploading file", "Reading rows", "Checking numbers and variables", "Saving recipients"]}
        />
      </Card>
      <div className="lg:col-span-2">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">Template</p>
        {template ? <TemplatePreview template={template} params={[]} /> : null}
      </div>
    </div>
  );
}

function BadRows({ rows }: { rows: { row: number; raw: string; reason: string }[] }) {
  return (
    <div className="max-h-64 overflow-auto rounded-lg border border-red-200">
      <table className="table">
        <thead>
          <tr><th>Row</th><th>Phone</th><th>Problem</th></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.row}><td>{r.row}</td><td className="font-mono text-xs">{r.raw || "(empty)"}</td><td className="text-red-700">{r.reason}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
