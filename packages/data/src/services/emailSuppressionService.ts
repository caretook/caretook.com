import type { ClearSuppressionInput, SuppressionReason, SuppressionSearchInput } from "../db/schema";
import type { Tx } from "../db";
import type { ServiceContext } from "./types";

import { and, count, desc, eq, ilike, inArray, isNull, sql } from "drizzle-orm";
import { SYSTEM_USER } from "../constants";
import { dbMayFail, getDb, txOrDb, withTransaction } from "../db";
import {
  clearSuppressionZSchema,
  emailSuppressionSchema as suppression,
  normalizeAddress,
  SUPPRESSION_PAGE_SIZE,
  suppressionSearchZSchema,
  userSchema,
} from "../db/schema";
import { isError, newError } from "../errors";
import * as adminAuditService from "./adminAuditService";
import { auditActorId, staffRefusal } from "./staffAccess";

// Suppressed email addresses (hosting PRD, slice 4). Resend's webhook
// suppresses an address after a hard bounce or a complaint; the outbox's
// delivery asks `suppressedAmong` before each send. Staff list the active
// suppressions (`users.read`) and clear one (`users.help`, with a reason,
// audited). Not a model service: the table is the system's only, so the
// queries are direct, like the outbox's.

const issuesOf = (error: { issues: { path: PropertyKey[]; message: string }[] }) =>
  error.issues.map((i) => ({ path: i.path.map(String).join("."), message: i.message }));

const invalid = (error: { issues: { path: PropertyKey[]; message: string }[] }) =>
  newError({ code: "emailSuppression:invalid", meta: { issues: issuesOf(error) } });

const containsPattern = (value: string) => `%${value.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

const active = isNull(suppression.clearedAt);

/**
 * Has the webhook event `eventId` been recorded already? A replayed event
 * (Svix retries, or a repeat) changes nothing.
 */
export const hasEvent = async (eventId: string, opts: { tx?: Tx } = {}) => {
  const rows = await dbMayFail(
    () =>
      txOrDb(opts.tx)
        .select({ id: suppression.id })
        .from(suppression)
        .where(eq(suppression.eventId, eventId))
        .limit(1),
    "emailSuppression:query",
  );
  return isError(rows) ? rows : rows.length > 0;
};

/**
 * The system: suppress `address` for `reason`, from webhook event `eventId`.
 * Idempotent: the same event twice, or an address already suppressed, adds
 * nothing. `suppressed` says whether this call added the row. In `tx` when
 * given (the webhook marks the outbox row in the same transaction).
 */
export const suppress = async (
  address: string,
  reason: SuppressionReason,
  eventId: string,
  opts: { tx?: Tx } = {},
) => {
  const normalized = normalizeAddress(address);
  if (!normalized || !eventId.trim()) {
    return newError({
      code: "emailSuppression:invalid",
      meta: { issues: [{ path: normalized ? "eventId" : "address", message: "Required" }] },
    });
  }
  const rows = await dbMayFail(
    () =>
      txOrDb(opts.tx)
        .insert(suppression)
        .values({
          address: normalized,
          reason,
          eventId: eventId.trim(),
          createdBy: SYSTEM_USER.id,
          updatedBy: SYSTEM_USER.id,
        })
        // Either unique index: the event id, or the address's active row.
        .onConflictDoNothing()
        .returning({ id: suppression.id }),
    "emailSuppression:query",
  );
  return isError(rows) ? rows : { suppressed: rows.length > 0 };
};

/** Which of `addresses` are suppressed now (normalized). */
export const suppressedAmong = async (addresses: readonly string[]) => {
  const list = [...new Set(addresses.map(normalizeAddress).filter(Boolean))];
  if (!list.length) return new Set<string>();
  const rows = await dbMayFail(
    () =>
      getDb()
        .select({ address: suppression.address })
        .from(suppression)
        .where(and(active, inArray(suppression.address, list))),
    "emailSuppression:query",
  );
  return isError(rows) ? rows : new Set(rows.map((r) => r.address));
};

/** Is `address` suppressed now? */
export const isSuppressed = async (address: string) => {
  const found = await suppressedAmong([address]);
  return isError(found) ? found : found.has(normalizeAddress(address));
};

/**
 * Staff (`users.read`): the active suppressions whose address contains
 * `query` (all of them without one), newest first, a page at a time, with
 * how many match.
 */
export const list = async (ctx: ServiceContext, input: SuppressionSearchInput) => {
  const refused = staffRefusal(ctx, "users.read");
  if (refused) return refused;
  const parsed = suppressionSearchZSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { query, page } = parsed.data;
  const where = query
    ? and(active, ilike(suppression.address, containsPattern(query.toLowerCase())))
    : active;
  const db = txOrDb(ctx.tx);
  const read = await dbMayFail(
    () =>
      Promise.all([
        db
          .select({
            id: suppression.id,
            address: suppression.address,
            reason: suppression.reason,
            createdAt: suppression.createdAt,
          })
          .from(suppression)
          .where(where)
          .orderBy(desc(suppression.createdAt), desc(suppression.id))
          .limit(SUPPRESSION_PAGE_SIZE)
          .offset((page - 1) * SUPPRESSION_PAGE_SIZE),
        db.select({ count: count() }).from(suppression).where(where),
      ]),
    "emailSuppression:query",
  );
  if (isError(read)) return read;
  const [rows, total] = read;
  return { count: total[0]?.count ?? 0, page, pageSize: SUPPRESSION_PAGE_SIZE, data: rows };
};

/**
 * Staff (`users.help`): clear `address`'s active suppression, with why, so
 * it gets mail again. The row stays (cleared), and `mail.suppressionCleared`
 * is recorded in the same transaction, naming the account with that address
 * when there is one. `emailSuppression:notFound` when it isn't suppressed.
 */
export const clear = (ctx: ServiceContext, input: ClearSuppressionInput) =>
  withTransaction(async (tx) => {
    const refused = staffRefusal(ctx, "users.help");
    if (refused) return refused;
    const parsed = clearSuppressionZSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    const address = normalizeAddress(parsed.data.address);
    const actorId = auditActorId(ctx);

    const cleared = await dbMayFail(
      () =>
        tx
          .update(suppression)
          .set({
            clearedAt: sql`now()`,
            clearedBy: actorId,
            clearReason: parsed.data.reason,
            updatedBy: actorId ?? SYSTEM_USER.id,
          })
          .where(and(active, eq(suppression.address, address)))
          .returning({ id: suppression.id, reason: suppression.reason }),
      "emailSuppression:query",
    );
    if (isError(cleared)) return cleared;
    const row = cleared[0];
    if (!row) return newError({ code: "emailSuppression:notFound" });

    const account = await dbMayFail(
      () =>
        tx
          .select({ id: userSchema.id })
          .from(userSchema)
          .where(eq(sql`lower(${userSchema.email})`, address))
          .limit(1),
      "emailSuppression:query",
    );
    if (isError(account)) return account;

    const recorded = await adminAuditService.record(tx, {
      actorId,
      action: "mail.suppressionCleared",
      targetUserId: account[0]?.id ?? null,
      reason: parsed.data.reason,
      changes: { address: [address, address], suppressed: [row.reason, null] },
    });
    if (isError(recorded)) return recorded;
    return { address, cleared: true as const };
  }, ctx);
