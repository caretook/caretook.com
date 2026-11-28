import type { AppError } from "../errors";
import type { Tx } from "../db";
import type {
  AccountHelpInput,
  AccountSearchInput,
  RevokeSessionInput,
  SetRoleInput,
  StaffRefusal,
} from "../db/schema";
import type { ServiceContext } from "./types";
import type { z } from "zod";

import { and, count, desc, eq, gt, ilike, isNull, like, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { SYSTEM_USER } from "../constants";
import { dbMayFail, txOrDb, withTransaction } from "../db";
import {
  accountHelpZSchema,
  accountSchema,
  auditChanges,
  ACCOUNT_PAGE_SIZE,
  accountSearchZSchema,
  careGroupMemberSchema,
  careGroupSchema,
  careRecipientSchema,
  disableRefusal,
  mailErrorCode,
  notificationOutboxSchema,
  RECENT_MAIL_LIMIT,
  revokeSessionZSchema,
  roleChangeRefusal,
  sessionSchema,
  setRoleZSchema,
  STAFF_REFUSAL_MESSAGES,
  userSchema,
  verificationSchema,
} from "../db/schema";
import { isError, newError } from "../errors";
import * as adminAuditService from "./adminAuditService";
import { revokeAllForUser } from "./connectorGrantService";
import { auditActorId, staffRefusal } from "./staffAccess";

// Staff account help (admin PRD, slice 2): find an account, see how it signs
// in, where it's signed in, its groups and the mail sent to it, and help:
// resend the verification email, send a password reset, sign sessions out.
//
// Every read selects named columns only, and nothing from a group's care
// data: a group appears by its name and its recipient's name, never more.
// Mail shows the template, status and times, never its data or body.
// Every help action needs `users.help`, a reason, and records an audit
// entry in its own transaction; opening an account records `user.view`.
// Better Auth's tables are the system's (PERMISSIONS): this service reads
// and writes them directly, after the capability check.
//
// Admins (slice 3) also disable and re-enable accounts and change staff
// roles, through the staff rules' guards: never yourself, never the last
// admin. packages/auth refuses a disabled account everywhere it signs in.

/** Who an account email goes to, for the injected mailer. */
export type AccountMailUser = { id: string; email: string; name: string | null };

/**
 * Queues the auth emails staff can send, in the action's transaction (the
 * tokens and templates belong to packages/auth, which the API passes in).
 */
export type AccountMailer = {
  verification: (user: AccountMailUser, tx: Tx) => Promise<{ id: string } | AppError>;
  reset: (user: AccountMailUser, tx: Tx) => Promise<{ id: string } | AppError>;
};

const containsPattern = (value: string) => `%${value.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

const issuesOf = (error: { issues: { path: PropertyKey[]; message: string }[] }) =>
  error.issues.map((i) => ({ path: i.path.map(String).join("."), message: i.message }));

const invalid = (error: { issues: { path: PropertyKey[]; message: string }[] }) =>
  newError({ code: "accountAdmin:invalid", meta: { issues: issuesOf(error) } });

const accountColumns = {
  id: userSchema.id,
  name: userSchema.name,
  email: userSchema.email,
  emailVerified: userSchema.emailVerified,
  role: userSchema.role,
  createdAt: userSchema.createdAt,
  disabledAt: userSchema.disabledAt,
  disabledBy: userSchema.disabledBy,
  disabledReason: userSchema.disabledReason,
};

const accountRow = async (userId: string, tx?: Tx) => {
  const rows = await dbMayFail(
    () => txOrDb(tx).select(accountColumns).from(userSchema).where(eq(userSchema.id, userId)).limit(1),
    "accountAdmin:query",
  );
  if (isError(rows)) return rows;
  return rows[0] ?? newError({ code: "accountAdmin:notFound" });
};

/**
 * Staff (`users.read`): accounts whose name or email contains `q` (all of
 * them without one), newest first, a page at a time, with how many match.
 */
export const search = async (ctx: ServiceContext, input: AccountSearchInput) => {
  const refused = staffRefusal(ctx, "users.read");
  if (refused) return refused;
  const parsed = accountSearchZSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { q, page } = parsed.data;
  const where = q
    ? or(ilike(userSchema.email, containsPattern(q)), ilike(userSchema.name, containsPattern(q)))
    : undefined;
  const db = txOrDb(ctx.tx);
  const rows = await dbMayFail(
    () =>
      db
        .select(accountColumns)
        .from(userSchema)
        .where(where)
        .orderBy(desc(userSchema.createdAt), desc(userSchema.id))
        .limit(ACCOUNT_PAGE_SIZE)
        .offset((page - 1) * ACCOUNT_PAGE_SIZE),
    "accountAdmin:query",
  );
  if (isError(rows)) return rows;
  const total = await dbMayFail(
    () => db.select({ count: count() }).from(userSchema).where(where),
    "accountAdmin:query",
  );
  if (isError(total)) return total;
  return { count: total[0]?.count ?? 0, page, pageSize: ACCOUNT_PAGE_SIZE, data: rows };
};

const inviter = alias(userSchema, "account_admin_inviter");
const disabler = alias(userSchema, "account_admin_disabler");

/**
 * Staff (`users.read`): everything an account's page shows, and the
 * `user.view` audit entry (in the background). `accountAdmin:notFound` for
 * an unknown id.
 */
export const get = async (ctx: ServiceContext, userId: string) => {
  const refused = staffRefusal(ctx, "users.read");
  if (refused) return refused;
  const account = await accountRow(userId, ctx.tx);
  if (isError(account)) return account;
  const db = txOrDb(ctx.tx);

  const read = await dbMayFail(
    () =>
      Promise.all([
        db
          .select({ id: accountSchema.id })
          .from(accountSchema)
          .where(and(eq(accountSchema.userId, userId), eq(accountSchema.providerId, "credential")))
          .limit(1),
        db
          .select({
            id: sessionSchema.id,
            userAgent: sessionSchema.userAgent,
            ipAddress: sessionSchema.ipAddress,
            createdAt: sessionSchema.createdAt,
            updatedAt: sessionSchema.updatedAt,
            expiresAt: sessionSchema.expiresAt,
          })
          .from(sessionSchema)
          .where(and(eq(sessionSchema.userId, userId), gt(sessionSchema.expiresAt, sql`now()`)))
          .orderBy(desc(sessionSchema.updatedAt), desc(sessionSchema.id)),
        db
          .select({
            groupId: careGroupMemberSchema.groupId,
            groupName: careGroupSchema.name,
            recipientName: careRecipientSchema.name,
            recipientPreferredName: careRecipientSchema.preferredName,
            role: careGroupMemberSchema.role,
            joinedAt: careGroupMemberSchema.createdAt,
            invitedById: careGroupMemberSchema.invitedBy,
            invitedByName: inviter.name,
            invitedByEmail: inviter.email,
          })
          .from(careGroupMemberSchema)
          .innerJoin(careGroupSchema, eq(careGroupSchema.id, careGroupMemberSchema.groupId))
          .leftJoin(careRecipientSchema, eq(careRecipientSchema.groupId, careGroupMemberSchema.groupId))
          .leftJoin(inviter, eq(inviter.id, careGroupMemberSchema.invitedBy))
          .where(eq(careGroupMemberSchema.userId, userId))
          .orderBy(desc(careGroupMemberSchema.createdAt)),
        db
          .select({
            id: notificationOutboxSchema.id,
            name: notificationOutboxSchema.name,
            status: notificationOutboxSchema.status,
            attempts: notificationOutboxSchema.attempts,
            createdAt: notificationOutboxSchema.createdAt,
            sentAt: notificationOutboxSchema.sentAt,
            lastError: notificationOutboxSchema.lastError,
          })
          .from(notificationOutboxSchema)
          .where(eq(sql`lower(${notificationOutboxSchema.recipient})`, account.email.toLowerCase()))
          .orderBy(desc(notificationOutboxSchema.createdAt), desc(notificationOutboxSchema.id))
          .limit(RECENT_MAIL_LIMIT),
        account.disabledBy
          ? db
              .select({ id: disabler.id, name: disabler.name, email: disabler.email })
              .from(disabler)
              .where(eq(disabler.id, account.disabledBy))
              .limit(1)
          : Promise.resolve([]),
      ]),
    "accountAdmin:query",
  );
  if (isError(read)) return read;
  const [password, sessions, groups, mail, disabledBy] = read;

  const actorId = auditActorId(ctx);
  if (actorId) adminAuditService.recordSoon({ actorId, action: "user.view", targetUserId: userId });

  return {
    account: { ...account, disabledBy: disabledBy[0] ?? null },
    hasPassword: password.length > 0,
    sessions,
    groups: groups.map(({ invitedById, invitedByName, invitedByEmail, ...group }) => ({
      ...group,
      displayName: group.recipientPreferredName || group.recipientName || group.groupName,
      invitedBy: invitedById ? { id: invitedById, name: invitedByName, email: invitedByEmail } : null,
    })),
    mail: mail.map(({ lastError, ...row }) => ({ ...row, errorCode: mailErrorCode(row.status, lastError) })),
  };
};

/** The checks every help action makes first: the capability, the input, the account. */
const helpTarget = async <T extends { userId: string; reason: string }>(
  ctx: ServiceContext,
  schema: z.ZodType<T>,
  input: unknown,
  tx: Tx,
) => {
  const refused = staffRefusal(ctx, "users.help");
  if (refused) return refused;
  const parsed = schema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const account = await accountRow(parsed.data.userId, tx);
  if (isError(account)) return account;
  return { input: parsed.data, account };
};

const mailUser = (account: { id: string; email: string; name: string | null }): AccountMailUser => ({
  id: account.id,
  email: account.email,
  name: account.name,
});

/**
 * Staff (`users.help`): a new verification email, for an account whose
 * address isn't confirmed yet (`accountAdmin:alreadyVerified` otherwise).
 * Returns the queued email's id (deliver it after commit).
 */
export const resendVerification = (
  ctx: ServiceContext,
  input: AccountHelpInput,
  opts: { mail: AccountMailer },
) =>
  withTransaction(async (tx) => {
    const target = await helpTarget(ctx, accountHelpZSchema, input, tx);
    if (isError(target)) return target;
    if (target.account.disabledAt) return newError({ code: "accountAdmin:disabled" });
    if (target.account.emailVerified) return newError({ code: "accountAdmin:alreadyVerified" });
    const queued = await opts.mail.verification(mailUser(target.account), tx);
    if (isError(queued)) return queued;
    const recorded = await adminAuditService.record(tx, {
      actorId: auditActorId(ctx),
      action: "user.resendVerification",
      targetUserId: target.account.id,
      reason: target.input.reason,
    });
    if (isError(recorded)) return recorded;
    return { queued: queued.id };
  }, ctx);

/**
 * Staff (`users.help`): a password reset email. Returns the queued email's
 * id. A disabled account gets neither email (`accountAdmin:disabled`).
 */
export const sendReset = (ctx: ServiceContext, input: AccountHelpInput, opts: { mail: AccountMailer }) =>
  withTransaction(async (tx) => {
    const target = await helpTarget(ctx, accountHelpZSchema, input, tx);
    if (isError(target)) return target;
    if (target.account.disabledAt) return newError({ code: "accountAdmin:disabled" });
    const queued = await opts.mail.reset(mailUser(target.account), tx);
    if (isError(queued)) return queued;
    const recorded = await adminAuditService.record(tx, {
      actorId: auditActorId(ctx),
      action: "user.sendReset",
      targetUserId: target.account.id,
      reason: target.input.reason,
    });
    if (isError(recorded)) return recorded;
    return { queued: queued.id };
  }, ctx);

/**
 * Staff (`users.help`): sign one session out (its row goes, so its next
 * request is signed out). `accountAdmin:sessionNotFound` when it's already
 * gone or isn't this account's.
 */
export const revokeSession = (ctx: ServiceContext, input: RevokeSessionInput) =>
  withTransaction(async (tx) => {
    const target = await helpTarget(ctx, revokeSessionZSchema, input, tx);
    if (isError(target)) return target;
    const removed = await dbMayFail(
      () =>
        tx
          .delete(sessionSchema)
          .where(
            and(eq(sessionSchema.id, target.input.sessionId), eq(sessionSchema.userId, target.account.id)),
          )
          .returning({ id: sessionSchema.id }),
      "accountAdmin:query",
    );
    if (isError(removed)) return removed;
    if (!removed.length) return newError({ code: "accountAdmin:sessionNotFound" });
    const recorded = await adminAuditService.record(tx, {
      actorId: auditActorId(ctx),
      action: "user.revokeSession",
      targetUserId: target.account.id,
      reason: target.input.reason,
      changes: { session: [target.input.sessionId, null] },
    });
    if (isError(recorded)) return recorded;
    return { revoked: 1 };
  }, ctx);

/**
 * Staff (`users.help`): sign every session out, and disconnect every
 * assistant (connector grants). Returns how many sessions there were.
 */
export const revokeAllSessions = (ctx: ServiceContext, input: AccountHelpInput) =>
  withTransaction(async (tx) => {
    const target = await helpTarget(ctx, accountHelpZSchema, input, tx);
    if (isError(target)) return target;
    const removed = await dbMayFail(
      () =>
        tx
          .delete(sessionSchema)
          .where(eq(sessionSchema.userId, target.account.id))
          .returning({ id: sessionSchema.id }),
      "accountAdmin:query",
    );
    if (isError(removed)) return removed;
    // A raw delete skips Better Auth's hooks, so the assistants go here (B-329).
    const disconnected = await revokeAllForUser(target.account.id, tx);
    if (isError(disconnected)) return disconnected;
    const recorded = await adminAuditService.record(tx, {
      actorId: auditActorId(ctx),
      action: "user.revokeAllSessions",
      targetUserId: target.account.id,
      reason: target.input.reason,
      changes: { sessions: [removed.length, 0] },
    });
    if (isError(recorded)) return recorded;
    return { revoked: removed.length };
  }, ctx);

// ---------------------------------------------------------------------------
// Disable, re-enable and staff roles (slice 3): admins only.
// ---------------------------------------------------------------------------

const REFUSAL_CODES = {
  self: "accountAdmin:self",
  lastAdmin: "accountAdmin:lastAdmin",
  unknownRole: "accountAdmin:unknownRole",
  unchanged: "accountAdmin:unchanged",
} as const satisfies Record<StaffRefusal, string>;

/** A guard's refusal as an error (an unknown role is an issue on its field). */
const refused = (refusal: StaffRefusal) =>
  refusal === "unknownRole"
    ? newError({
        code: REFUSAL_CODES[refusal],
        meta: { issues: [{ path: "role", message: STAFF_REFUSAL_MESSAGES.unknownRole }] },
      })
    : newError({ code: REFUSAL_CODES[refusal] });

/** The checks an admin action makes first: the capability, the input, the account (locked). */
const adminTarget = async <T extends { userId: string; reason: string }>(
  ctx: ServiceContext,
  capability: "users.disable" | "users.setRole",
  schema: z.ZodType<T>,
  input: unknown,
  tx: Tx,
) => {
  const refusal = staffRefusal(ctx, capability);
  if (refusal) return refusal;
  const parsed = schema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const rows = await dbMayFail(
    () =>
      tx
        .select(accountColumns)
        .from(userSchema)
        .where(eq(userSchema.id, parsed.data.userId))
        .for("update")
        .limit(1),
    "accountAdmin:query",
  );
  if (isError(rows)) return rows;
  const account = rows[0];
  if (!account) return newError({ code: "accountAdmin:notFound" });
  return { input: parsed.data, account };
};

/**
 * How many enabled admins there are, the rows locked so two admins can't
 * each demote or disable the other at once and leave none.
 */
const enabledAdminCount = async (tx: Tx) => {
  const rows = await dbMayFail(
    () =>
      tx
        .select({ id: userSchema.id })
        .from(userSchema)
        .where(and(eq(userSchema.role, "admin"), isNull(userSchema.disabledAt)))
        .for("update"),
    "accountAdmin:query",
  );
  return isError(rows) ? rows : rows.length;
};

/**
 * A disabled account's pending sign-in links, codes and reset links, so
 * none of them works after it's re-enabled either (Better Auth's
 * `verification` rows: `sign-in-otp-<email>`, `magic-link:<token>` with the
 * address in its value, `reset-password:<token>` with the user id).
 */
const voidPendingLinks = (tx: Tx, account: { id: string; email: string }) => {
  const email = account.email.toLowerCase();
  return dbMayFail(
    () =>
      tx
        .delete(verificationSchema)
        .where(
          or(
            eq(verificationSchema.identifier, `sign-in-otp-${email}`),
            and(
              like(verificationSchema.identifier, "reset-password:%"),
              eq(verificationSchema.value, account.id),
            ),
            and(
              like(verificationSchema.identifier, "magic-link:%"),
              sql`strpos(lower(${verificationSchema.value}), ${`"email":${JSON.stringify(email)}`}) > 0`,
            ),
          ),
        ),
    "accountAdmin:query",
  );
};

/**
 * Admins (`users.disable`): disable an account. Every session and every
 * assistant's connection goes, its pending sign-in and reset links stop
 * working, and it can't sign in or get a sync token until it's re-enabled
 * (packages/auth); memberships and data stay. One transaction with its audit entry. Never yourself, never the last
 * admin. Returns how many sessions were signed out.
 */
export const disable = (ctx: ServiceContext, input: AccountHelpInput) =>
  withTransaction(async (tx) => {
    const target = await adminTarget(ctx, "users.disable", accountHelpZSchema, input, tx);
    if (isError(target)) return target;
    const { account } = target;
    if (account.disabledAt) return newError({ code: "accountAdmin:alreadyDisabled" });
    const adminCount = await enabledAdminCount(tx);
    if (isError(adminCount)) return adminCount;
    const refusal = disableRefusal({
      actorId: auditActorId(ctx),
      targetId: account.id,
      targetRole: account.role,
      adminCount,
    });
    if (refusal) return refused(refusal);

    const actorId = auditActorId(ctx);
    const updated = await dbMayFail(
      () =>
        tx
          .update(userSchema)
          .set({
            disabledAt: sql`now()`,
            disabledBy: actorId,
            disabledReason: target.input.reason,
            updatedBy: ctx.authUser?.id ?? SYSTEM_USER.id,
          })
          .where(eq(userSchema.id, account.id)),
      "accountAdmin:query",
    );
    if (isError(updated)) return updated;
    const removed = await dbMayFail(
      () =>
        tx
          .delete(sessionSchema)
          .where(eq(sessionSchema.userId, account.id))
          .returning({ id: sessionSchema.id }),
      "accountAdmin:query",
    );
    if (isError(removed)) return removed;
    const disconnected = await revokeAllForUser(account.id, tx);
    if (isError(disconnected)) return disconnected;
    const voided = await voidPendingLinks(tx, account);
    if (isError(voided)) return voided;

    const recorded = await adminAuditService.record(tx, {
      actorId,
      action: "user.disable",
      targetUserId: account.id,
      reason: target.input.reason,
      changes: { disabled: [false, true], sessions: [removed.length, 0] },
    });
    if (isError(recorded)) return recorded;
    return { revoked: removed.length };
  }, ctx);

/**
 * Admins (`users.disable`): re-enable a disabled account, with a reason. It
 * signs in again as before; nothing else changed while it was disabled.
 */
export const enable = (ctx: ServiceContext, input: AccountHelpInput) =>
  withTransaction(async (tx) => {
    const target = await adminTarget(ctx, "users.disable", accountHelpZSchema, input, tx);
    if (isError(target)) return target;
    const { account } = target;
    if (!account.disabledAt) return newError({ code: "accountAdmin:notDisabled" });
    const updated = await dbMayFail(
      () =>
        tx
          .update(userSchema)
          .set({
            disabledAt: null,
            disabledBy: null,
            disabledReason: null,
            updatedBy: ctx.authUser?.id ?? SYSTEM_USER.id,
          })
          .where(eq(userSchema.id, account.id)),
      "accountAdmin:query",
    );
    if (isError(updated)) return updated;
    const recorded = await adminAuditService.record(tx, {
      actorId: auditActorId(ctx),
      action: "user.enable",
      targetUserId: account.id,
      reason: target.input.reason,
      changes: { disabled: [true, false] },
    });
    if (isError(recorded)) return recorded;
    return { enabled: true };
  }, ctx);

/**
 * Admins (`users.setRole`): make an account support or admin, or a member
 * again, with a reason. Never your own role, never the last admin.
 */
export const setRole = (ctx: ServiceContext, input: SetRoleInput) =>
  withTransaction(async (tx) => {
    const target = await adminTarget(ctx, "users.setRole", setRoleZSchema, input, tx);
    if (isError(target)) return target;
    const { account } = target;
    const enabled = await enabledAdminCount(tx);
    if (isError(enabled)) return enabled;
    // A disabled admin isn't one of the enabled admins, so demoting them
    // leaves every enabled admin in place.
    const adminCount = enabled + (account.role === "admin" && account.disabledAt ? 1 : 0);
    const refusal = roleChangeRefusal({
      actorId: auditActorId(ctx),
      targetId: account.id,
      from: account.role,
      to: target.input.role,
      adminCount,
    });
    if (refusal) return refused(refusal);
    const role = target.input.role as (typeof account)["role"];

    const updated = await dbMayFail(
      () =>
        tx
          .update(userSchema)
          .set({ role, updatedBy: ctx.authUser?.id ?? SYSTEM_USER.id })
          .where(eq(userSchema.id, account.id)),
      "accountAdmin:query",
    );
    if (isError(updated)) return updated;
    const recorded = await adminAuditService.record(tx, {
      actorId: auditActorId(ctx),
      action: "user.setRole",
      targetUserId: account.id,
      reason: target.input.reason,
      changes: auditChanges(account, { role }, ["role"]),
    });
    if (isError(recorded)) return recorded;
    return { role };
  }, ctx);
