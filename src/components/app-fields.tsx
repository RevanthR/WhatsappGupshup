type AppValues = {
  name?: string;
  gupshupAppName?: string;
  gupshupAppId?: string | null;
  sourceNumber?: string;
  apiKeyLast4?: string;
};

// Edit form fields for a WhatsApp number. Same wording as the connect wizard.
export function AppFields({ values = {} }: { values?: AppValues }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <label className="label" htmlFor="name">Name in WA Sender</label>
        <input id="name" name="name" required defaultValue={values.name} className="input" placeholder="e.g. Sales line" />
      </div>
      <div>
        <label className="label" htmlFor="gupshupAppName">Gupshup app name</label>
        <input id="gupshupAppName" name="gupshupAppName" required defaultValue={values.gupshupAppName} className="input" autoComplete="off" />
        <p className="hint">Exactly as in Gupshup. Case sensitive.</p>
      </div>
      <div>
        <label className="label" htmlFor="gupshupAppId">Gupshup app ID</label>
        <input id="gupshupAppId" name="gupshupAppId" defaultValue={values.gupshupAppId ?? ""} className="input font-mono text-xs" autoComplete="off" />
        <p className="hint">Needed for app-level API keys.</p>
      </div>
      <div>
        <label className="label" htmlFor="sourceNumber">WhatsApp number</label>
        <input id="sourceNumber" name="sourceNumber" required defaultValue={values.sourceNumber ? `+${values.sourceNumber}` : ""} className="input" inputMode="tel" />
      </div>
      <div>
        <label className="label" htmlFor="apiKey">New API key</label>
        <input
          id="apiKey"
          name="apiKey"
          type="password"
          autoComplete="off"
          className="input font-mono"
          placeholder={values.apiKeyLast4 ? `Leave blank to keep key ending ${values.apiKeyLast4}` : "Paste the Gupshup API key"}
        />
        <p className="hint">Stored encrypted. Never shown again.</p>
      </div>
    </div>
  );
}
