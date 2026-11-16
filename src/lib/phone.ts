import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";

// Gupshup wants digits only with country code, no "+". Numbers without a
// country code are read as the default country (India unless configured).
export function normalizePhone(input: unknown, defaultCountry: CountryCode = "IN"): string | null {
  if (input === null || input === undefined) return null;
  let raw = String(input).trim();
  if (!raw) return null;
  // Excel sometimes turns long numbers into "9.19876543210E+11".
  if (/^\d+(\.\d+)?e\+\d+$/i.test(raw)) raw = Number(raw).toFixed(0);
  raw = raw.replace(/[\s\-().]/g, "");
  if (raw.startsWith("00")) raw = "+" + raw.slice(2);
  const parsed = raw.startsWith("+")
    ? parsePhoneNumberFromString(raw)
    : parsePhoneNumberFromString(raw, defaultCountry) ??
      parsePhoneNumberFromString("+" + raw);
  if (parsed?.isValid()) return parsed.number.replace("+", "");
  // Fall back to "+digits" if the number already looks international.
  const withPlus = parsePhoneNumberFromString("+" + raw.replace(/^\+/, ""));
  if (withPlus?.isValid()) return withPlus.number.replace("+", "");
  return null;
}

export function formatPhone(digits: string): string {
  const parsed = parsePhoneNumberFromString("+" + digits);
  return parsed ? parsed.formatInternational() : "+" + digits;
}
