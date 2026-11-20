import type { Tx } from "../db";

import { sql } from "drizzle-orm";
import { SYSTEM_USER } from "../constants";
import { dbMayFail, getDb, withTransaction } from "../db";
import { ident, literal, personalAccessSql, schemaTables, scramVerifier } from "../db/roles";
import { auditChanges, isStaff } from "../db/schema";
import { isError, newError } from "../errors";
import { userModel } from "../models";
import * as adminAuditService from "./adminAuditService";

export const serviceName = "dbAccess";
export const schemaName = userModel.schemaName;

// Personal database access (hosting PRD, `pnpm db:access`): a staff member
// gets a named LOGIN role that can only read, never the secrets
// (`PERSONAL_ACCESS_EXCLUDED`: the auth tables, rate limits, invite tokens,
// access codes and email bodies), and that stops working at its
// VALID UNTIL (at most 24 hours). Each grant and revoke is recorded in the
// audit log in the same transaction, as the system with the staff member as
// the target. Runs with the migrations role (CREATEROLE), never from the app.

export const MAX_ACCESS_HOURS = 24;
export const PERSONAL_ROLE_PREFIX = "staff_";

/** Written on each personal role, so `list` finds only ours. */
const ROLE_COMMENT = "caretook personal access";

export const GRANT_REASON = "Granted with pnpm db:access";
export const REVOKE_REASON = "Revoked with pnpm db:access";

/** `staff_<email as a lower-case identifier>`, within Postgres's 63 characters. */
export const personalRoleName = (email: string) =>
  (
    PERSONAL_ROLE_PREFIX +
    userModel
      .normalizeEmail(email)
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
  ).slice(0, 63);

const findStaff = async (tx: Tx, email: string) => {
  const user = await userModel.getWhole({
    authUser: SYSTEM_USER,
    tx,
    filter: { email: { type: "eq", value: userModel.normalizeEmail(email) } },
  });
  if (isError(user)) return user;
  if (!user) return newError({ code: "dbAccess:unknownAddress" });
  if (!isStaff([user.role]) || user.disabledAt) return newError({ code: "dbAccess:notStaff" });
  return user;
};

const exec = (tx: Tx, statement: string) =>
  dbMayFail(() => tx.execute(sql.raw(statement)), "dbAccess:failed");

const roleExists = async (tx: Tx, role: string) => {
  const res = await dbMayFail(
    () => tx.execute(sql`SELECT 1 FROM pg_roles WHERE rolname = ${role}`),
    "dbAccess:failed",
  );
  return isError(res) ? res : res.rows.length > 0;
};

export type GrantResult = {
  userId: string;
  email: string;
  role: string;
  validUntil: string;
  /** Shown once by the script, never stored or logged. */
  password: string;
};

/**
 * Give the staff account at `email` a read-only LOGIN role valid for `hours`
 * (1–24) with `password`. A second grant resets the password and the expiry.
 * Non-staff, disabled and unknown accounts are refused.
 */
export const grant = ({
  email,
  hours,
  password,
  reason = GRANT_REASON,
  now = new Date(),
}: {
  email: string;
  hours: number;
  password: string;
  reason?: string;
  now?: Date;
}) =>
  withTransaction(async (tx): Promise<GrantResult | ReturnType<typeof newError>> => {
    if (!Number.isInteger(hours) || hours < 1 || hours > MAX_ACCESS_HOURS)
      return newError({ code: "dbAccess:invalidHours" });
    const user = await findStaff(tx, email);
    if (isError(user)) return user;

    const role = personalRoleName(user.email);
    const r = ident(role);
    const validUntil = new Date(now.getTime() + hours * 3_600_000).toISOString();
    const exists = await roleExists(tx, role);
    if (isError(exists)) return exists;

    // The verifier, not the password, so a server that logs DDL never logs it.
    const login = `LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOINHERIT PASSWORD ${literal(scramVerifier(password))} VALID UNTIL ${literal(validUntil)}`;
    const statements = [
      exists ? `ALTER ROLE ${r} ${login}` : `CREATE ROLE ${r} ${login}`,
      `COMMENT ON ROLE ${r} IS ${literal(`${ROLE_COMMENT}: ${user.id}`)}`,
      `ALTER ROLE ${r} SET default_transaction_read_only = on`,
      `DO $$ BEGIN EXECUTE format('GRANT CONNECT ON DATABASE %I TO ${r.replace(/'/g, "''")}', current_database()); END $$`,
      `GRANT USAGE ON SCHEMA public TO ${r}`,
      ...personalAccessSql(role, schemaTables()).grant,
    ];
    for (const statement of statements) {
      const res = await exec(tx, statement);
      if (isError(res)) return res;
    }

    const recorded = await adminAuditService.record(tx, {
      actorId: null,
      action: "db.accessGranted",
      targetUserId: user.id,
      reason,
      changes: auditChanges(null, { role, hours, validUntil }, ["role", "hours", "validUntil"]),
    });
    if (isError(recorded)) return recorded;
    return { userId: user.id, email: user.email, role, validUntil, password };
  });

/**
 * Drop the personal role of the account at `email`, ending its open
 * sessions first (best effort), and record it. Safe to run twice: with no
 * role there's nothing to drop or record (`dropped: false`).
 */
export const revoke = ({ email, reason = REVOKE_REASON }: { email: string; reason?: string }) =>
  withTransaction(async (tx) => {
    const user = await userModel.getWhole({
      authUser: SYSTEM_USER,
      tx,
      filter: { email: { type: "eq", value: userModel.normalizeEmail(email) } },
    });
    if (isError(user)) return user;
    if (!user) return newError({ code: "dbAccess:unknownAddress" });

    const role = personalRoleName(user.email);
    const exists = await roleExists(tx, role);
    if (isError(exists)) return exists;
    if (!exists) return { userId: user.id, email: user.email, role, dropped: false };

    // A dropped role's open sessions would carry on until they disconnect.
    // Best effort, in a savepoint: without the right to signal them, the
    // drop still goes ahead (and the password stops working).
    await tx
      .transaction((sp) =>
        sp.execute(sql`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE usename = ${role}`),
      )
      .catch(() => undefined);
    // Undo exactly what `grant` gave (DROP OWNED would need the role's own
    // privileges, which the migrations role may not have), then drop it.
    const r = ident(role);
    const statements = [
      ...personalAccessSql(role, schemaTables()).revoke,
      `REVOKE USAGE ON SCHEMA public FROM ${r}`,
      `DO $$ BEGIN EXECUTE format('REVOKE CONNECT ON DATABASE %I FROM ${r.replace(/'/g, "''")}', current_database()); END $$`,
      `DROP ROLE ${r}`,
    ];
    for (const statement of statements) {
      const res = await exec(tx, statement);
      if (isError(res)) return res;
    }

    const recorded = await adminAuditService.record(tx, {
      actorId: null,
      action: "db.accessRevoked",
      targetUserId: user.id,
      reason,
      changes: auditChanges({ role }, null, ["role"]),
    });
    if (isError(recorded)) return recorded;
    return { userId: user.id, email: user.email, role, dropped: true };
  });

export type PersonalRole = {
  role: string;
  userId: string | null;
  validUntil: string | null;
  expired: boolean;
};

/** Every personal role, with its expiry; an expired one is listed until revoked. */
export const list = (now = new Date()) =>
  dbMayFail(async () => {
    const res = await getDb().execute(sql`
      SELECT rolname, rolvaliduntil, shobj_description(oid, 'pg_authid') AS comment
      FROM pg_roles
      WHERE rolname LIKE ${`${PERSONAL_ROLE_PREFIX}%`}
        AND shobj_description(oid, 'pg_authid') LIKE ${`${ROLE_COMMENT}:%`}
      ORDER BY rolvaliduntil NULLS LAST, rolname`);
    return (res.rows as { rolname: string; rolvaliduntil: Date | string | null; comment: string }[]).map(
      (row): PersonalRole => {
        const validUntil = row.rolvaliduntil ? new Date(row.rolvaliduntil).toISOString() : null;
        return {
          role: row.rolname,
          userId: row.comment.slice(ROLE_COMMENT.length + 1).trim() || null,
          validUntil,
          expired: validUntil !== null && new Date(validUntil) <= now,
        };
      },
    );
  }, "dbAccess:failed");
