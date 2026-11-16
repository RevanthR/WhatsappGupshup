"use client";

import { useActionState, useState, useTransition, type ReactNode } from "react";
import { createNumberAction, verifyConnectionAction, type VerifyResult } from "@/app/actions/accounts";
import { Alert } from "@/components/ui";
import { BusyModal } from "@/components/busy-modal";
import { Spinner, toast } from "@/components/toast";

type Acct = { id: string; name: string };

function StepHead({ n, title, done, active }: { n: number; title: string; done: boolean; active: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <span
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
          done ? "bg-emerald-600 text-white" : active ? "bg-brand-600 text-white" : "bg-gray-200 text-gray-600"
        }`}
      >
        {done ? "✓" : n}
      </span>
      <p className={`font-medium ${active || done ? "text-gray-900" : "text-gray-500"}`}>{title}</p>
    </div>
  );
}

function Where({ children }: { children: ReactNode }) {
  return (
    <details className="mt-1 text-xs text-gray-500">
      <summary className="cursor-pointer text-brand-700 hover:underline">Where do I find this?</summary>
      <div className="mt-1 rounded-lg bg-gray-50 p-2 leading-relaxed">{children}</div>
    </details>
  );
}

export function ConnectWizard({ accounts, initialAccountId }: { accounts: Acct[]; initialAccountId?: string }) {
  const [step, setStep] = useState(1);
  const [accountId, setAccountId] = useState(initialAccountId ?? accounts[0]?.id ?? "__new");
  const [newAccountName, setNewAccountName] = useState("");
  const [f, setF] = useState({ name: "", gupshupAppName: "", gupshupAppId: "", sourceNumber: "", apiKey: "" });
  const [verify, setVerify] = useState<VerifyResult | null>(null);
  const [testing, startTest] = useTransition();
  const [state, action, saving] = useActionState(createNumberAction, undefined);

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setF((s) => ({ ...s, [k]: e.target.value }));
    setVerify(null); // details changed, test again
  };
  const accountLabel = accountId === "__new" ? newAccountName : accounts.find((a) => a.id === accountId)?.name;
  const step1Done = step > 1;
  const canTest = f.gupshupAppName && f.apiKey;
  const verified = verify?.ok === true;

  const runTest = () =>
    startTest(async () => {
      const r = await verifyConnectionAction({ gupshupAppName: f.gupshupAppName, gupshupAppId: f.gupshupAppId, apiKey: f.apiKey });
      setVerify(r);
      toast(r.ok ? `Connected. Found ${r.approved} approved template${r.approved === 1 ? "" : "s"}.` : r.error, r.ok ? "success" : "error");
    });

  return (
    <div className="space-y-4">
      {/* Step 1: account */}
      <section className="card p-4 sm:p-5">
        <StepHead n={1} title="Which business is this number for?" done={step1Done} active={step === 1} />
        {step === 1 ? (
          <div className="mt-4 space-y-4 sm:pl-10">
            <p className="text-sm text-gray-600">
              Numbers are grouped by <b>Gupshup account</b>, usually one per business or client. Pick one, or create it now.
            </p>
            <div className="space-y-2">
              {accounts.map((a) => (
                <label key={a.id} className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 text-sm ${accountId === a.id ? "border-brand-500 bg-brand-50" : "border-gray-200 hover:bg-gray-50"}`}>
                  <input type="radio" name="acct" checked={accountId === a.id} onChange={() => setAccountId(a.id)} className="accent-brand-600" />
                  {a.name}
                </label>
              ))}
              <label className={`flex cursor-pointer flex-wrap items-center gap-3 rounded-lg border px-3 py-2.5 text-sm ${accountId === "__new" ? "border-brand-500 bg-brand-50" : "border-gray-200 hover:bg-gray-50"}`}>
                <input type="radio" name="acct" checked={accountId === "__new"} onChange={() => setAccountId("__new")} className="accent-brand-600" />
                New business
                {accountId === "__new" ? (
                  <input
                    autoFocus
                    value={newAccountName}
                    onChange={(e) => setNewAccountName(e.target.value)}
                    placeholder="e.g. AS Interior Studio"
                    className="input mt-1 basis-full sm:mt-0 sm:flex-1 sm:basis-auto"
                  />
                ) : null}
              </label>
            </div>
            <button
              type="button"
              className="btn-primary"
              disabled={accountId === "__new" && !newAccountName.trim()}
              onClick={() => setStep(2)}
            >
              Continue
            </button>
          </div>
        ) : (
          <div className="mt-2 flex items-center justify-between gap-2 sm:pl-10">
            <p className="text-sm text-gray-600">{accountLabel}</p>
            <button type="button" className="text-sm text-brand-700 hover:underline" onClick={() => setStep(1)}>Change</button>
          </div>
        )}
      </section>

      {/* Step 2: Gupshup details + test */}
      <section className="card p-4 sm:p-5">
        <StepHead n={2} title="Gupshup app details" done={false} active={step === 2} />
        {step === 2 ? (
          <form action={action} className="mt-4 space-y-4 sm:pl-10">
            <input type="hidden" name="accountId" value={accountId} />
            <input type="hidden" name="newAccountName" value={newAccountName} />
            <p className="text-sm text-gray-600">
              In Gupshup, every WhatsApp number is an <b>app</b>. Copy these four things from that app.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="gupshupAppName">App name</label>
                <input id="gupshupAppName" name="gupshupAppName" required value={f.gupshupAppName} onChange={set("gupshupAppName")} className="input" placeholder="ASInteriorStudio" autoComplete="off" />
                <Where>Gupshup dashboard, your apps list. Copy the name exactly. It is case sensitive and has no spaces.</Where>
              </div>
              <div>
                <label className="label" htmlFor="gupshupAppId">App ID</label>
                <input id="gupshupAppId" name="gupshupAppId" value={f.gupshupAppId} onChange={set("gupshupAppId")} className="input font-mono text-xs" placeholder="260dc464-fe34-468a-..." autoComplete="off" />
                <Where>Open the app in Gupshup. The ID is in the page address after <code>/app/</code>, or under the app&apos;s settings. It looks like <code>260dc464-fe34-...</code>.</Where>
              </div>
              <div>
                <label className="label" htmlFor="sourceNumber">WhatsApp number</label>
                <input id="sourceNumber" name="sourceNumber" required value={f.sourceNumber} onChange={set("sourceNumber")} className="input" placeholder="+91 90632 22590" inputMode="tel" />
                <Where>The business phone number registered on this Gupshup app, with country code.</Where>
              </div>
              <div>
                <label className="label" htmlFor="apiKey">API key</label>
                <input id="apiKey" name="apiKey" required type="password" value={f.apiKey} onChange={set("apiKey")} className="input font-mono" autoComplete="off" placeholder="Paste the API key" />
                <Where>
                  Open the app in Gupshup, find <b>API Keys</b>, click <b>Create API key</b> and copy it. Do not use the App ID, the
                  Customer App Token or the Account Secret. Older Gupshup accounts show the key under the profile menu (top right).
                </Where>
              </div>
            </div>
            <div>
              <label className="label" htmlFor="name">Name for this number in WA Sender</label>
              <input id="name" name="name" required value={f.name} onChange={set("name")} className="input" placeholder="e.g. Sales line" />
            </div>

            {verify && !verify.ok ? (
              <Alert tone="error">
                <p className="font-medium">{verify.error}</p>
                {verify.detail ? <p className="mt-1 break-words text-xs opacity-80">{verify.detail}</p> : null}
              </Alert>
            ) : null}
            {verify?.ok ? (
              <Alert tone="success">
                <p className="font-medium">Connected to Gupshup.</p>
                <p className="mt-1 text-xs">
                  Found {verify.total} template{verify.total === 1 ? "" : "s"}, {verify.approved} approved
                  {verify.names.length ? `: ${verify.names.join(", ")}` : ""}.
                </p>
              </Alert>
            ) : null}
            {state?.error ? <Alert tone="error">{state.error}</Alert> : null}

            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn-secondary" disabled={!canTest || testing} onClick={runTest}>
                {testing ? <><Spinner /> Testing...</> : verified ? "Test again" : "Test connection"}
              </button>
              <button className="btn-primary" disabled={!verified || saving || !f.name || !f.sourceNumber}>
                {saving ? <><Spinner /> Saving...</> : "Save and continue"}
              </button>
            </div>
            {!verified ? <p className="hint">Test the connection first. Saving is enabled once Gupshup accepts the details.</p> : null}
            <BusyModal open={saving} title="Connecting number" steps={["Checking details with Gupshup", "Saving encrypted API key", "Importing templates"]} />
          </form>
        ) : null}
      </section>

      {/* Step 3: webhook (happens on the number page) */}
      <section className="card p-4 sm:p-5">
        <StepHead n={3} title="Connect the webhook" done={false} active={false} />
        <p className="mt-2 text-sm text-gray-500 sm:pl-10">Next screen. Paste one URL into Gupshup so delivery reports and replies come in.</p>
      </section>
    </div>
  );
}
