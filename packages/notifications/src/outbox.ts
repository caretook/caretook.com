import type { AppError, Tx } from "@caretook/data";
import type { NotificationName } from "./registry";
import type { NotificationData } from "./render";
import type { Sender } from "./senders";

import {
  SYSTEM_USER,
  dbMayFail,
  getDb,
  isError,
  logError,
  newError,
  notificationOutboxSchema as outbox,
  txOrDb,
} from "@caretook/data";
import { and, eq, inArray, lt, lte, or, sql } from "drizzle-orm";
import { z } from "zod";
import { getMailConfig } from "./config";
import { NOTIFICATIONS } from "./registry";
import { renderNotification } from "./render";
import { getSender } from "./senders";

/** A message is marked failed after this many attempts. */
export const MAX_ATTEMPTS = 8;
/** One sweep claims at most this many rows. */
export const BATCH_LIMIT = 100;
/** Sent (and skipped) rows are deleted after this many days. */
export const PURGE_AFTER_DAYS = 30;
/** A row left `sending` this long (a crashed sweep) is claimed again. */
export const STALE_CLAIM_MINUTES = 10;

const BACKOFF_BASE_MS = 60_000;
const BACKOFF_MAX_MS = 6 * 60 * 60_000;

/** Wait before the next try after `attempts` failed ones: 1, 2, 4 … minutes, at most 6 h. */
export const retryDelayMs = (attempts: number) =>
  Math.min(BACKOFF_BASE_MS * 2 ** Math.max(0, attempts - 1), BACKOFF_MAX_MS);

// ---------------------------------------------------------------------------
// Running delivery after the response
// ---------------------------------------------------------------------------

type BackgroundRunner = (work: Promise<unknown>) => void;

const fireAndForget: BackgroundRunner = (work) => {
  work.catch((error: unknown) => logError("mail: background delivery failed", error));
};

let runInBackground: BackgroundRunner = fireAndForget;

/**
 * How work after a response is kept alive. The default is fire-and-forget
 * (dev and Node servers). On Vercel, register `waitUntil` so the function
 * isn't frozen mid-send. Either way the cron sweep picks up anything missed.
 */
export const setBackgroundRunner = (runner: BackgroundRunner | null) => {
  runInBackground = runner ?? fireAndForget;
};

/**
 * Run `work` after the response, through the registered runner (`waitUntil`
 * on Vercel). For callers that must not await a send, such as Better Auth's
 * email callbacks: awaiting would make "no such account" answer faster.
 */
export const inBackground = (work: () => Promise<unknown>) => {
  runInBackground(Promise.resolve().then(work));
};

/**
 * Deliver these outbox rows now, in the background. Call it after the
 * transaction that queued them commits (notify() does, when it ran outside
 * a transaction).
 */
export const deliverSoon = (ids: string | readonly string[], opts: { sender?: Sender } = {}) => {
  const list = typeof ids === "string" ? [ids] : [...ids];
  if (list.length) runInBackground(deliverDue({ ids: list, sender: opts.sender }));
};

// ---------------------------------------------------------------------------
// notify
// ---------------------------------------------------------------------------

export type NotifyOptions<N extends NotificationName> = {
  to: string;
  /** Who caused it (the audit columns); the system when left out. */
  actor?: { id: string };
  data: NotificationData<N>;
  /**
   * Unique per message, e.g. `invite:<id>:<token hash>`. A second notify()
   * with the same key queues nothing, and Resend gets it too.
   */
  idempotencyKey: string;
  /** The caller's transaction: the row commits or rolls back with it. */
  tx?: Tx;
  /**
   * Outside a transaction, delivery starts right away in the background
   * (default true). Inside one, the caller calls deliverSoon(id) after commit.
   */
  deliver?: boolean;
};

export type Queued = { id: string; created: boolean };

const recipientZ = z.email();

/**
 * Queue a notification: validate its data, render it, and write an outbox
 * row (in `tx` when given). Returns the row's id, or an AppError for bad data
 * or a failed write. Never sends inside the caller's request.
 */
export const notify = async <N extends NotificationName>(
  name: N,
  { to, actor, data, idempotencyKey, tx, deliver = true }: NotifyOptions<N>,
): Promise<Queued | AppError> => {
  const recipient = to.trim();
  if (!recipientZ.safeParse(recipient).success) {
    return newError({
      code: "notify:invalidData",
      meta: { name, issues: [{ path: "to", message: "Not an email address" }] },
    });
  }
  if (!idempotencyKey.trim()) {
    return newError({
      code: "notify:invalidData",
      meta: { name, issues: [{ path: "idempotencyKey", message: "Required" }] },
    });
  }

  const config = getMailConfig();
  const rendered = await renderNotification(name, data, { recipient, appUrl: config.appUrl });
  if (isError(rendered)) return rendered;

  const db = txOrDb(tx);
  const by = actor?.id ?? SYSTEM_USER.id;
  const queued = await dbMayFail(async (): Promise<Queued> => {
    const [row] = await db
      .insert(outbox)
      .values({ name, recipient, ...rendered, idempotencyKey, createdBy: by, updatedBy: by })
      .onConflictDoNothing({ target: outbox.idempotencyKey })
      .returning({ id: outbox.id });
    if (row) return { id: row.id, created: true };
    const [existing] = await db
      .select({ id: outbox.id })
      .from(outbox)
      .where(eq(outbox.idempotencyKey, idempotencyKey));
    if (!existing) throw new Error("Outbox row vanished after a key conflict");
    return { id: existing.id, created: false };
  }, "notify:enqueue");
  if (isError(queued)) return queued;

  if (!tx && deliver && queued.created) deliverSoon(queued.id);
  return queued;
};

// ---------------------------------------------------------------------------
// Delivery
// ---------------------------------------------------------------------------

export type DeliverySummary = {
  claimed: number;
  sent: number;
  skipped: number;
  retried: number;
  failed: number;
};

/** What a sensitive message's body becomes once it's delivered or failed. */
export const REDACTED_BODY = "[Removed after delivery: this message carried a sign-in link or code.]";

/** A sensitive notification's HTML and text, blanked; nothing for the others. */
const redactedBody = (name: string) =>
  (NOTIFICATIONS as Record<string, { sensitive?: boolean }>)[name]?.sensitive
    ? { html: REDACTED_BODY, text: REDACTED_BODY }
    : {};

const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error)).slice(0, 2000);

/**
 * Claim due rows (pending and due, or stuck in `sending`) with
 * `FOR UPDATE SKIP LOCKED`, so concurrent sweeps never take the same row,
 * and mark them `sending` in the same statement.
 */
const claim = (limit: number, ids?: readonly string[]) => {
  const db = getDb();
  const due = or(
    and(eq(outbox.status, "pending"), lte(outbox.nextAttemptAt, sql`now()`)),
    and(
      eq(outbox.status, "sending"),
      lt(outbox.claimedAt, sql`now() - make_interval(mins => ${STALE_CLAIM_MINUTES})`),
    ),
  );
  const candidates = db
    .select({ id: outbox.id })
    .from(outbox)
    .where(ids ? and(due, inArray(outbox.id, [...ids])) : due)
    .orderBy(outbox.nextAttemptAt)
    .limit(limit)
    .for("update", { skipLocked: true });

  return db
    .update(outbox)
    .set({
      status: "sending",
      attempts: sql`${outbox.attempts} + 1`,
      claimedAt: sql`now()`,
      updatedBy: SYSTEM_USER.id,
    })
    .where(inArray(outbox.id, candidates))
    .returning();
};

/**
 * Send what's due: up to `limit` rows (or just `ids`), each once. A failure
 * goes back to pending with exponential backoff, and is marked failed after
 * MAX_ATTEMPTS.
 */
export const deliverDue = async ({
  limit = BATCH_LIMIT,
  ids,
  sender,
}: { limit?: number; ids?: readonly string[]; sender?: Sender } = {}): Promise<
  DeliverySummary | AppError
> => {
  const claimed = await dbMayFail(() => claim(Math.min(limit, BATCH_LIMIT), ids), "notify:deliver");
  if (isError(claimed)) return claimed;

  const summary: DeliverySummary = { claimed: claimed.length, sent: 0, skipped: 0, retried: 0, failed: 0 };
  if (!claimed.length) return summary;

  const config = getMailConfig();
  const via = sender ?? getSender(config);
  const db = getDb();
  const mine = (id: string) => and(eq(outbox.id, id), eq(outbox.status, "sending"));

  for (const row of claimed) {
    let result: Awaited<ReturnType<Sender["send"]>>;
    try {
      result = await via.send({
        name: row.name,
        to: row.recipient,
        from: config.from,
        subject: row.subject,
        html: row.html,
        text: row.text,
        idempotencyKey: row.idempotencyKey,
      });
    } catch (error) {
      result = { status: "error", error: errorText(error) };
    }

    const done = await dbMayFail(async () => {
      if (result.status === "sent") {
        summary.sent++;
        await db
          .update(outbox)
          .set({
            status: "sent",
            sentAt: sql`now()`,
            ...redactedBody(row.name),
            providerMessageId: result.providerMessageId ?? null,
            lastError: null,
          })
          .where(mine(row.id));
      } else if (result.status === "skipped") {
        summary.skipped++;
        await db
          .update(outbox)
          .set({ status: "skipped", sentAt: sql`now()`, lastError: result.reason, ...redactedBody(row.name) })
          .where(mine(row.id));
      } else if (row.attempts >= MAX_ATTEMPTS) {
        summary.failed++;
        // The sender's error text can name the address: it stays in `last_error`, not the log.
        logError("mail: delivery failed for good", "sender error", {
          notification: row.name,
          recordId: row.id,
          attempts: row.attempts,
        });
        await db
          .update(outbox)
          .set({ status: "failed", lastError: errorText(result.error), ...redactedBody(row.name) })
          .where(mine(row.id));
      } else {
        summary.retried++;
        await db
          .update(outbox)
          .set({
            status: "pending",
            lastError: errorText(result.error),
            nextAttemptAt: sql`now() + make_interval(secs => ${retryDelayMs(row.attempts) / 1000})`,
          })
          .where(mine(row.id));
      }
    }, "notify:deliver");
    // The row stays `sending` and is reclaimed after STALE_CLAIM_MINUTES;
    // the idempotency key keeps that from becoming a second email.
    if (isError(done)) logError("mail: couldn't record a delivery", done, { recordId: row.id });
  }
  return summary;
};

/** Delete sent and skipped rows older than `olderThanDays`. Returns how many. */
export const purgeSent = async ({ olderThanDays = PURGE_AFTER_DAYS } = {}) => {
  const removed = await dbMayFail(
    () =>
      getDb()
        .delete(outbox)
        .where(
          and(
            inArray(outbox.status, ["sent", "skipped"]),
            lt(outbox.sentAt, sql`now() - make_interval(days => ${olderThanDays})`),
          ),
        )
        .returning({ id: outbox.id }),
    "notify:deliver",
  );
  return isError(removed) ? removed : removed.length;
};

/** One cron run: deliver what's due, then purge old sent rows. */
export const sweepOutbox = async (opts: { sender?: Sender; limit?: number } = {}) => {
  const delivered = await deliverDue(opts);
  if (isError(delivered)) return delivered;
  const purged = await purgeSent();
  if (isError(purged)) return purged;
  return { ...delivered, purged };
};
