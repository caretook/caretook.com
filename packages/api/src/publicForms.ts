import type { ContactMailer } from "@caretook/data";

import {
  contactMessageService,
  contactSendZSchema,
  waitlistJoinZSchema,
  waitlistService,
} from "@caretook/data";
import { deliverSoon, getSupportEmail, notify } from "@caretook/notifications";
import { ORPCError } from "@orpc/server";
import { unwrap } from "./errors";
import { publicProcedure } from "./procedures";
import { createRateLimiter } from "./rateLimit";

// `public.*` (marketing slice 4): the marketing site's forms, open to anyone.
// Each answers a person and a bot alike: `{ ok: true }`, whether the entry
// was stored, updated, or dropped by a spam rule (the honeypot or the
// minimum time on the page; see publicForms.ts in @caretook/data). Past the
// per-IP rate limit a caller gets a 429. No IP address is stored.

/** Calls allowed per IP address per form in any minute: the 11th is refused. */
export const PUBLIC_FORM_LIMIT = 10;
const WINDOW_MS = 60_000;

const limiters = {
  waitlist: createRateLimiter({ limit: PUBLIC_FORM_LIMIT, windowMs: WINDOW_MS }),
  contact: createRateLimiter({ limit: PUBLIC_FORM_LIMIT, windowMs: WINDOW_MS }),
};

/** For tests: forget every address's count. */
export const resetPublicFormLimits = () => {
  for (const limiter of Object.values(limiters)) limiter.reset();
};

const limited = (form: keyof typeof limiters, clientIp: string | null | undefined) => {
  if (!limiters[form].hit(clientIp?.trim() || "unknown")) {
    throw new ORPCError("TOO_MANY_REQUESTS", { message: "Too many tries. Wait a minute and try again." });
  }
};

/** Queues `contactMessage` to the support address in the message's transaction. */
const contactMailer = (): ContactMailer => (message, tx) =>
  notify("contactMessage", {
    to: getSupportEmail(),
    data: {
      messageId: message.id,
      name: message.name,
      email: message.email,
      topic: message.topic,
      message: message.message,
    },
    idempotencyKey: `contactMessage:${message.id}`,
    tx,
  });

const THANKS = { ok: true } as const;

export const publicForms = {
  waitlist: {
    /** Join the waitlist, or update your entry (same address, any case). */
    join: publicProcedure.input(waitlistJoinZSchema).handler(async ({ context, input }) => {
      limited("waitlist", context.clientIp);
      unwrap(await waitlistService.join(input));
      return THANKS;
    }),
  },
  contact: {
    /** Write to the team: stored, and emailed to SUPPORT_EMAIL. */
    send: publicProcedure.input(contactSendZSchema).handler(async ({ context, input }) => {
      limited("contact", context.clientIp);
      const sent = unwrap(await contactMessageService.send(input, { mail: contactMailer() }));
      if (sent.stored) deliverSoon(sent.queued);
      return THANKS;
    }),
  },
};
