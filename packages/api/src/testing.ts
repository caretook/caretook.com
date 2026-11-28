// Test-only (integration tests): the router as a caller would reach it, and
// sync.upload as a device's queue posts it. Never imported by app code.
// The /mcp helpers are in connectors/testing.ts.
import type { AuthUser } from "@caretook/data";
import type { CrudOp } from "./sync";

import { createRouterClient, ORPCError } from "@orpc/server";
import { router } from "./router";

/** The router as `authUser` (null: signed out), in process. `clientIp` for the public forms' rate limit. */
export const clientFor = (authUser: AuthUser | null, clientIp?: string) =>
  createRouterClient(router, { context: { authUser, ...(clientIp ? { clientIp } : {}) } });
export type Api = ReturnType<typeof clientFor>;

/** The ORPCError a call fails with; throws when it succeeds or fails otherwise. */
export const rejection = async (call: Promise<unknown>) => {
  const error = await call.then(
    () => undefined,
    (e: unknown) => e,
  );
  if (!(error instanceof ORPCError)) throw new Error(`Expected an ORPCError, got ${String(error)}`);
  return error as ORPCError<string, { code?: string; issues?: { path: string; message: string }[] }>;
};

/** "ok", or the ORPCError code a call fails with (anything else is rethrown). */
export const codeOf = async (call: Promise<unknown>) => {
  try {
    await call;
    return "ok";
  } catch (e) {
    if (e instanceof ORPCError) return String(e.code);
    throw e;
  }
};

/** "ok", or "<ORPCError code>:<the service's error code>" a call fails with. */
export const codesOf = async (call: Promise<unknown>) => {
  try {
    await call;
    return "ok";
  } catch (e) {
    if (e instanceof ORPCError)
      return `${e.code}:${String((e.data as { code?: string } | undefined)?.code ?? "")}`;
    throw e;
  }
};

// ---------------------------------------------------------------------------
// sync.upload: rows as a device's SQLite holds them (snake_case, JSON as
// text, booleans as 1/0, PowerSync's timestamp text).
// ---------------------------------------------------------------------------

/** A time `ms` from now, as PowerSync's SQLite text ("…T10:00:00.000000Z"). */
export const sqliteTime = (ms = 0) => new Date(Date.now() + ms).toISOString().replace(/Z$/, "000Z");

/** A device's CRUD ops, as PowerSync queues them; `write` is the local transaction they're part of. */
export const putOp = (table: string, id: string, data: Record<string, unknown>, write?: number) =>
  ({ op: "PUT", table, id, data, ...(write === undefined ? {} : { write }) }) as const;
export const patchOp = (table: string, id: string, data: Record<string, unknown>, write?: number) =>
  ({ op: "PATCH", table, id, data, ...(write === undefined ? {} : { write }) }) as const;
export const deleteOp = (table: string, id: string, write?: number) =>
  ({ op: "DELETE", table, id, ...(write === undefined ? {} : { write }) }) as const;

/** Upload one batch as `api`'s device: each op's result, in order. */
export const upload = async (api: Api, ops: CrudOp[]) => (await api.sync.upload({ ops })).results;

/** Upload one batch: each op's outcome, "applied" or the refusal's code. */
export const outcomes = async (api: Api, ops: CrudOp[]) =>
  (await upload(api, ops)).map((r) => (r.status === "rejected" ? r.code : r.status));
