import type { OutboxStatus, SuppressionReason, Tx } from "@caretook/data";

import {
  dbMayFail,
  emailSuppressionService,
  isError,
  logError,
  notificationOutboxSchema as outbox,
  withTransaction,
} from "@caretook/data";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { verifyWebhook } from "./webhookSignature";

// Resend's bounce and complaint webhook (hosting PRD, slice 4), behind the
// web-only `/api/webhooks/resend`. A request must carry a valid Svix
// signature for RESEND_WEBHOOK_SECRET (401 otherwise). A hard bounce
// (`email.bounced` with a Permanent bounce) and a complaint
// (`email.complained`) suppress the recipient and mark the message's outbox
// row (found by Resend's message id) as bounced or complained, in one
// transaction. Anything else, and a repeated Svix id, is a 200 that changes
// nothing. The body is never logged: it names the recipient.

/** Bodies over this are refused before they're verified (Resend's are a few KB). */
export const WEBHOOK_MAX_BYTES = 256 * 1024;

const eventZ = z.looseObject({
  type: z.string(),
  data: z
    .looseObject({
      email_id: z.string().optional(),
      to: z.union([z.array(z.string()), z.string()]).optional(),
      bounce: z.looseObject({ type: z.string().optional() }).optional(),
    })
    .optional(),
});

type ResendEvent = z.infer<typeof eventZ>;

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

/** What an event does: suppress for a reason and mark the row, or nothing. */
export const webhookAction = (
  event: ResendEvent,
): { reason: SuppressionReason; status: Extract<OutboxStatus, "bounced" | "complained"> } | null => {
  if (event.type === "email.bounced")
    return event.data?.bounce?.type?.toLowerCase() === "permanent"
      ? { reason: "bounce", status: "bounced" }
      : null;
  if (event.type === "email.complained") return { reason: "complaint", status: "complained" };
  return null;
};

const recipients = (event: ResendEvent) => {
  const to = event.data?.to;
  return (Array.isArray(to) ? to : to ? [to] : []).map((a) => a.trim()).filter(Boolean);
};

/** Suppress the event's recipients and mark its outbox row, once per Svix id. */
const applyEvent = (
  eventId: string,
  event: ResendEvent,
  action: NonNullable<ReturnType<typeof webhookAction>>,
) =>
  withTransaction(async (tx: Tx) => {
    const seen = await emailSuppressionService.hasEvent(eventId, { tx });
    if (isError(seen)) return seen;
    if (seen) return { applied: false };

    const messageId = event.data?.email_id;
    if (messageId) {
      const marked = await dbMayFail(
        () =>
          tx
            .update(outbox)
            .set({ status: action.status })
            .where(
              and(
                eq(outbox.providerMessageId, messageId),
                inArray(outbox.status, ["sent", "bounced", "complained"]),
              ),
            ),
        "notify:deliver",
      );
      if (isError(marked)) return marked;
    }

    // One row per address; the first takes the Svix id itself (what replays are checked by).
    const addresses = recipients(event);
    for (const [i, address] of addresses.entries()) {
      const done = await emailSuppressionService.suppress(
        address,
        action.reason,
        i === 0 ? eventId : `${eventId}#${i}`,
        { tx },
      );
      if (isError(done)) return done;
    }
    return { applied: true };
  });

/**
 * The webhook: verify, then act on a hard bounce or a complaint. Without a
 * configured secret it refuses every request (503), like the cron.
 */
export const handleResendWebhook = async (
  request: Request,
  { secret = process.env.RESEND_WEBHOOK_SECRET, now = Date.now() }: { secret?: string; now?: number } = {},
) => {
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!secret?.trim()) return json({ error: "RESEND_WEBHOOK_SECRET is not set" }, 503);

  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > WEBHOOK_MAX_BYTES) return json({ error: "Too large" }, 413);
  const body = await request.text();
  if (Buffer.byteLength(body) > WEBHOOK_MAX_BYTES) return json({ error: "Too large" }, 413);

  const verified = verifyWebhook({ headers: request.headers, body, secret, now });
  if (!verified.ok) return json({ error: "Unauthorized" }, 401);

  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return json({ error: "Not JSON" }, 400);
  }
  const event = eventZ.safeParse(parsed);
  if (!event.success) return json({ error: "Not a Resend event" }, 400);

  const action = webhookAction(event.data);
  if (!action) return json({ ok: true, applied: false }, 200);

  const result = await applyEvent(verified.id, event.data, action);
  if (isError(result)) {
    // The code only: never the body, which names the recipient.
    logError("mail: webhook failed", result);
    return json({ error: "Failed" }, 500);
  }
  return json({ ok: true, applied: result.applied }, 200);
};
