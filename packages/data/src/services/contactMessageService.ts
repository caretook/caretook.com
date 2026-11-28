import type { Tx } from "../db";
import type { ContactSendInput, SpamVerdict } from "../db/schema";
import type { AppError } from "../errors";
import type { ContactMessageModel } from "../models";
import type { ServiceContext, ServiceSelectArgs } from "./types";

import { DEFAULT_PAGE_SIZE, SYSTEM_USER } from "../constants";
import { withTransaction } from "../db";
import { contactSendZSchema, spamVerdict } from "../db/schema";
import { isError, newError } from "../errors";
import { contactMessageModel } from "../models";

export const schemaName = contactMessageModel.schemaName;

type K = typeof schemaName;

// The contact form (marketing slice 4): the message is stored and its email
// to the support address queued in one transaction, so neither exists
// without the other. The mailer is injected (the API passes one that calls
// notify), as invites do, so this package never depends on notifications.

/** Queues the support email for `message` in `tx`; returns the outbox row's id. */
export type ContactMailer = (message: ContactMessageModel, tx: Tx) => Promise<{ id: string } | AppError>;

export type SendResult =
  | { stored: true; message: ContactMessageModel; queued: string[] }
  | { stored: false; verdict: Exclude<SpamVerdict, "ok"> };

/**
 * Store a message from the public form and queue its email, as the system.
 * A submission that trips a spam rule stores and sends nothing. Call
 * `deliverSoon(queued)` after it returns (the transaction has committed).
 */
export const send = async (input: ContactSendInput, { mail }: { mail: ContactMailer }) => {
  const parsed = contactSendZSchema.safeParse(input);
  if (!parsed.success) {
    return newError({
      code: "publicForms:invalid",
      meta: { issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })) },
    });
  }
  const { website, elapsedMs, ...fields } = parsed.data;
  const verdict = spamVerdict({ website, elapsedMs });
  if (verdict !== "ok") return { stored: false, verdict } satisfies SendResult;

  return withTransaction(async (tx): Promise<SendResult | AppError> => {
    const message = await contactMessageModel.create({ authUser: SYSTEM_USER, tx, data: fields });
    if (isError(message)) return message;
    if (!message) return newError({ code: "baseModel:create:nothingCreated" });
    const queued = await mail(message, tx);
    if (isError(queued)) return queued;
    return { stored: true, message, queued: [queued.id] };
  });
};

/** Staff: messages, scoped by the permission map (global admin only). */
export const list = (ctx: ServiceContext, opts: ServiceSelectArgs<K> = {}) =>
  contactMessageModel.list({
    ...ctx,
    ...opts,
    paginate: opts.paginate ?? { page: 1, limit: DEFAULT_PAGE_SIZE },
  });
