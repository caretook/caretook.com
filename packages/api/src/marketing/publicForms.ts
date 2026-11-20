import type { ContactMailer } from "@caretook/data";

import {
  appSettingService,
  contactMessageService,
  contactSendZSchema,
  waitlistJoinZSchema,
  waitlistService,
} from "@caretook/data";
import { deliverSoon, getSupportEmail, notify } from "@caretook/notifications";
import { ORPCError } from "@orpc/server";
import { unwrap } from "../errors";
import { publicProcedure } from "../procedures";
import { createRateLimiter, defaultStore } from "../rateLimit";

// `public.*` (marketing slice 4): the marketing site's forms, open to anyone.
// Each answers a person and a bot alike: `{ ok: true }`, whether the entry
// was stored, updated, or dropped by a spam rule (the honeypot or the
// minimum time on the page; see publicForms.ts in @caretook/data). Past the
// per-IP rate limit a caller gets a 429. In production the counts are shared
// by every instance (rateLimit.ts's `postgresStore`): the table holds the
// IP address for the window only, and the outbox cron purges it.

/**
 * Calls allowed per IP address per form in any minute by default (the 11th
 * is refused). The `publicForms.perMinute` app setting changes it.
 */
export const PUBLIC_FORM_LIMIT = 10;
const WINDOW_MS = 60_000;

const limiters = {
  waitlist: createRateLimiter({
    limit: PUBLIC_FORM_LIMIT,
    windowMs: WINDOW_MS,
    store: defaultStore("publicForms.waitlist"),
  }),
  contact: createRateLimiter({
    limit: PUBLIC_FORM_LIMIT,
    windowMs: WINDOW_MS,
    store: defaultStore("publicForms.contact"),
  }),
};

/** For tests: forget every address's count. */
export const resetPublicFormLimits = async () => {
  for (const limiter of Object.values(limiters)) await limiter.reset();
};

const limited = async (form: keyof typeof limiters, clientIp: string | null | undefined) => {
  const perMinute = await appSettingService.getSetting("publicForms.perMinute");
  if (!(await limiters[form].hit(clientIp?.trim() || "unknown", Date.now(), perMinute))) {
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
      await limited("waitlist", context.clientIp);
      unwrap(await waitlistService.join(input));
      return THANKS;
    }),
  },
  contact: {
    /** Write to the team: stored, and emailed to SUPPORT_EMAIL. */
    send: publicProcedure.input(contactSendZSchema).handler(async ({ context, input }) => {
      await limited("contact", context.clientIp);
      const sent = unwrap(await contactMessageService.send(input, { mail: contactMailer() }));
      if (sent.stored) deliverSoon(sent.queued);
      return THANKS;
    }),
  },
};
