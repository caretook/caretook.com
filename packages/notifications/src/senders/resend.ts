import type { Sender } from "./types";

import { Resend } from "resend";

/**
 * Production: Resend. It returns `{ error }` rather than throwing, so both are
 * checked. The outbox key goes in as Resend's idempotency key, so a retried
 * send after a lost response is not a second email.
 *
 * Open and click tracking are per-domain settings in Resend, not per message:
 * keep both off on the sending domain (no tracking pixels or rewritten links).
 */
export const createResendSender = (opts: { apiKey: string }): Sender => {
  const resend = new Resend(opts.apiKey);
  return {
    name: "resend",
    send: async (message) => {
      try {
        const { data, error } = await resend.emails.send(
          {
            from: message.from,
            to: message.to,
            subject: message.subject,
            html: message.html,
            text: message.text,
            ...(message.headers ? { headers: message.headers } : {}),
          },
          { idempotencyKey: message.idempotencyKey },
        );
        if (error) return { status: "error", error: `${error.name}: ${error.message}` };
        return { status: "sent", providerMessageId: data?.id };
      } catch (cause) {
        return { status: "error", error: cause instanceof Error ? cause.message : String(cause) };
      }
    },
  };
};
