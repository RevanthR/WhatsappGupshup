type AppValues = {
  name?: string;
  gupshupAppName?: string;
  gupshupAppId?: string | null;
  sourceNumber?: string;
  apiKeyLast4?: string;
};

export function AppFields({ values = {}, requireKey = false, narrow = false }: { values?: AppValues; requireKey?: boolean; narrow?: boolean }) {
  return (
    <div className={`grid gap-4 ${narrow ? "sm:grid-cols-2 lg:grid-cols-1" : "sm:grid-cols-2"}`}>
      <div>
        <label className="label" htmlFor="name">Display name</label>
        <input id="name" name="name" required defaultValue={values.name} className="input" placeholder="e.g. Acme Support" />
      </div>
      <div>
        <label className="label" htmlFor="gupshupAppName">Gupshup app name</label>
        <input id="gupshupAppName" name="gupshupAppName" required defaultValue={values.gupshupAppName} className="input" placeholder="e.g. AcmeSupport" />
        <p className="hint">Exactly as shown in the Gupshup dashboard (used as src.name).</p>
      </div>
      <div>
        <label className="label" htmlFor="sourceNumber">Sender WhatsApp number</label>
        <input id="sourceNumber" name="sourceNumber" required defaultValue={values.sourceNumber ? `+${values.sourceNumber}` : ""} className="input" placeholder="+91 98765 43210" inputMode="tel" />
      </div>
      <div>
        <label className="label" htmlFor="gupshupAppId">Gupshup app ID (optional)</label>
        <input id="gupshupAppId" name="gupshupAppId" defaultValue={values.gupshupAppId ?? ""} className="input" placeholder="xxxxxxxx-xxxx-..." />
      </div>
      <div className={narrow ? "sm:col-span-2 lg:col-span-1" : "sm:col-span-2"}>
        <label className="label" htmlFor="apiKey">API key</label>
        <input
          id="apiKey"
          name="apiKey"
          type="password"
          autoComplete="off"
          required={requireKey}
          className="input font-mono"
          placeholder={values.apiKeyLast4 ? `Saved key ending in ${values.apiKeyLast4}. Leave blank to keep it.` : "Paste the Gupshup API key"}
        />
        <p className="hint">Stored encrypted. It is never shown again after saving.</p>
      </div>
    </div>
  );
}
