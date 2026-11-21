// Plain-English explanations for common WhatsApp (Meta) and Gupshup errors.
// The raw text is kept and shown smaller next to the explanation.

const META: Record<string, string> = {
  "131049": "Meta limited marketing messages to this person to protect their experience. Try later, or after they message you.",
  "131026": "Could not be delivered. The number may not be on WhatsApp, or their app is too old.",
  "131047": "More than 24 hours since this person last messaged you. Only templates can be sent now.",
  "131048": "Meta rate-limited this number for spam signals. Slow down and check template quality.",
  "131050": "This person has stopped marketing messages from your business.",
  "131051": "This message type is not supported.",
  "131052": "WhatsApp could not download the media. Check the link is public.",
  "131053": "Media upload failed. Check the file type and size.",
  "131056": "Too many messages to this number in a short time. Try again shortly.",
  "131021": "Recipient is the same as the sender number.",
  "131031": "The WhatsApp Business account is locked. Check Meta Business Manager.",
  "131042": "Payment problem on the WhatsApp Business account. Check billing in Meta or Gupshup.",
  "131000": "Something went wrong at WhatsApp. Try again.",
  "132000": "The number of variables does not match the template. Re-sync templates.",
  "132001": "Template not found in this language. Re-sync templates.",
  "132005": "Message text is too long after filling variables.",
  "132007": "Template content violates WhatsApp policy.",
  "132012": "A variable value has the wrong format.",
  "132015": "Template is paused by Meta for low quality.",
  "132016": "Template is disabled by Meta for low quality.",
  "130472": "Meta held this marketing message back as part of an experiment. Not your fault.",
  "130429": "WhatsApp rate limit reached. Sending will slow down.",
  "429": "Sent faster than this WhatsApp number allows. WA Sender now slows down and retries these on its own.",
  "470": "More than 24 hours since this person last messaged you. Only templates can be sent now.",
  "1013": "This number is not on WhatsApp.",
};

const GUPSHUP: [RegExp, string][] = [
  [/portal user not found with apikey/i, "Gupshup does not recognise this API key. Use the app's API key from Gupshup (app, API Keys), not the app ID, Customer App Token or Account Secret."],
  [/invalid app details/i, "Gupshup app name does not match this API key. Check the app name (it is case sensitive)."],
  [/invalid destination/i, "This phone number is not valid for WhatsApp."],
  [/authentication failed|unauthori[sz]ed/i, "Gupshup rejected the API key."],
  [/template.*(not found|does not exist)/i, "Gupshup could not find this template. Re-sync templates."],
  [/insufficient balance|wallet/i, "Not enough balance in the Gupshup wallet."],
  [/network error|timeout|aborted/i, "Could not reach Gupshup. Try again."],
];

export function friendlyError(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const code = raw.match(/\b(1[0-9]{3,5}|470|429)\b/)?.[1];
  if (code && META[code]) return META[code];
  for (const [re, text] of GUPSHUP) if (re.test(raw)) return text;
  return null;
}

// WhatsApp or Gupshup throughput limits. Safe to send again after a pause.
export function isRateLimitError(raw: string | null | undefined): boolean {
  return !!raw && /(^|\D)(429|130429)(\D|$)/.test(raw);
}
