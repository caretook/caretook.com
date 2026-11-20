import { createHmac, timingSafeEqual } from "node:crypto";

// Svix's webhook signatures (Resend signs its webhooks with Svix), checked
// with node:crypto rather than the svix package. The scheme:
//
//   - headers `svix-id`, `svix-timestamp` (Unix seconds) and `svix-signature`
//     (space-separated `v1,<base64>` entries: several while a secret rotates);
//   - each signature is base64 HMAC-SHA256 over `${id}.${timestamp}.${body}`,
//     keyed by the secret's base64 after its `whsec_` prefix;
//   - a timestamp more than 5 minutes from now is refused (replays).
//
// Pure: the caller passes the raw body exactly as received, and the time.

/** How far the signed timestamp may be from now. */
export const WEBHOOK_TOLERANCE_MS = 5 * 60_000;

const SECRET_PREFIX = "whsec_";

export type WebhookHeaders = Headers | Record<string, string | undefined>;

export type WebhookVerification =
  | { ok: true; id: string; timestamp: number }
  | { ok: false; reason: "missingHeaders" | "badSecret" | "badTimestamp" | "expired" | "badSignature" };

const header = (headers: WebhookHeaders, name: string) =>
  (headers instanceof Headers ? headers.get(name) : headers[name])?.trim() ?? "";

/** The secret's key bytes (with or without `whsec_`), or null when it's empty. */
const secretKey = (secret: string) => {
  const raw = secret.trim();
  const key = Buffer.from(raw.startsWith(SECRET_PREFIX) ? raw.slice(SECRET_PREFIX.length) : raw, "base64");
  return key.length ? key : null;
};

/** Is `body` signed by `secret`, at a time near `now` (ms)? Constant-time comparison. */
export const verifyWebhook = ({
  headers,
  body,
  secret,
  now,
}: {
  headers: WebhookHeaders;
  body: string;
  secret: string;
  now: number;
}): WebhookVerification => {
  const id = header(headers, "svix-id");
  const timestamp = header(headers, "svix-timestamp");
  const signatures = header(headers, "svix-signature");
  if (!id || !timestamp || !signatures) return { ok: false, reason: "missingHeaders" };

  const key = secretKey(secret);
  if (!key) return { ok: false, reason: "badSecret" };

  if (!/^\d{1,12}$/.test(timestamp)) return { ok: false, reason: "badTimestamp" };
  const seconds = Number(timestamp);
  if (Math.abs(now - seconds * 1000) > WEBHOOK_TOLERANCE_MS) return { ok: false, reason: "expired" };

  const expected = createHmac("sha256", key).update(`${id}.${timestamp}.${body}`).digest();
  let matched = false;
  for (const entry of signatures.split(" ")) {
    const [version, signature] = entry.split(",", 2);
    if (version !== "v1" || !signature) continue;
    const given = Buffer.from(signature, "base64");
    // Check every entry (no early exit), so the time doesn't say which matched.
    if (given.length === expected.length && timingSafeEqual(given, expected)) matched = true;
  }
  return matched ? { ok: true, id, timestamp: seconds } : { ok: false, reason: "badSignature" };
};

/** Sign `body` as Svix does: the headers a webhook request carries (for tests and local tools). */
export const signWebhook = ({
  id,
  body,
  secret,
  timestamp,
}: {
  id: string;
  body: string;
  secret: string;
  /** Unix seconds. */
  timestamp: number;
}) => {
  const key = secretKey(secret) ?? Buffer.alloc(0);
  const signature = createHmac("sha256", key).update(`${id}.${timestamp}.${body}`).digest("base64");
  return { "svix-id": id, "svix-timestamp": String(timestamp), "svix-signature": `v1,${signature}` };
};
