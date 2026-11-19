import type { AccessCode, Tx } from "../../db";

import { eq, sql } from "drizzle-orm";
import { dbMayFail, txOrDb } from "../../db";
import { accessCodeSchema } from "../../db/schema";
import { isError } from "../../errors";
import * as baseModel from "../base";

export const schemaName = "accessCodeSchema";

export const dbToModel = (row: AccessCode) => row;

const base = baseModel.getFunctions({ schemaName, dbToModel });

// Created, listed and revoked by staff (RBAC: global admin). The code is
// made by accessCodeService; nothing else changes it.
export const { create, get, getById, list, update } = base;

// ---------------------------------------------------------------------------
// Unscoped helpers for accessCodeService: holding a code is what entitles
// someone to know whether it works and to redeem it.
// ---------------------------------------------------------------------------

/** The code row for an already-normalized `code`, or null. With `lock`, `FOR UPDATE`. */
export const getByCode = async (code: string, opts: { tx?: Tx; lock?: boolean } = {}) => {
  const res = await dbMayFail(() => {
    const query = txOrDb(opts.tx)
      .select()
      .from(accessCodeSchema)
      .where(eq(accessCodeSchema.code, code))
      .limit(1);
    return opts.lock ? query.for("update") : query;
  }, "accessCodeModel:getByCode");
  if (isError(res)) return res;
  const [row] = res;
  return row ? dbToModel(row) : null;
};

/** Count one more use (inside the redeeming transaction). */
export const countUse = async (id: string, tx: Tx) => {
  const res = await dbMayFail(
    () =>
      tx
        .update(accessCodeSchema)
        .set({ useCount: sql`${accessCodeSchema.useCount} + 1` })
        .where(eq(accessCodeSchema.id, id))
        .returning({ useCount: accessCodeSchema.useCount }),
    "accessCodeModel:countUse",
  );
  if (isError(res)) return res;
  return res[0]?.useCount ?? 0;
};
