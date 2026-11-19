import type { Sender } from "./senders";

import { isError } from "@caretook/data";
import { createHash, timingSafeEqual } from "node:crypto";
import { sweepOutbox } from "./outbox";

const digest = (value: string) => createHash("sha256").update(value).digest();

/** Does the request carry `Authorization: Bearer <secret>`? Constant time. */
export const hasCronSecret = (request: Request, secret: string) => {
  const header = request.headers.get("authorization") ?? "";
  const match = /^Bearer (.+)$/.exec(header);
  return !!match?.[1] && timingSafeEqual(digest(match[1]), digest(secret));
};

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

/**
 * The outbox sweep behind `/api/cron/outbox` (Vercel Cron sends
 * `Authorization: Bearer $CRON_SECRET`). Without a configured secret it
 * refuses every request.
 */
export const handleOutboxCron = async (
  request: Request,
  { secret = process.env.CRON_SECRET, sender }: { secret?: string; sender?: Sender } = {},
) => {
  if (!secret?.trim()) return json({ error: "CRON_SECRET is not set" }, 503);
  if (!hasCronSecret(request, secret.trim())) return json({ error: "Unauthorized" }, 401);

  const result = await sweepOutbox({ sender });
  if (isError(result)) {
    console.error("[mail] outbox sweep failed", result);
    return json({ error: "Sweep failed" }, 500);
  }
  return json(result, 200);
};
