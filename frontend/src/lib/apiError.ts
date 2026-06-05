import type { Translations } from "@/lib/i18n";

/**
 * Resolve an API error to a localized message. Backend business errors return a
 * stable code (e.g. "err_payment_conflict") as the message; map it to the locale
 * string. Falls back to the raw message, then to a generic error label.
 */
export function apiError(err: unknown, t: Translations): string {
  const msg = err instanceof Error ? err.message : "";
  const mapped = (t as unknown as Record<string, unknown>)[msg];
  if (typeof mapped === "string") return mapped;
  return msg || t.error;
}
