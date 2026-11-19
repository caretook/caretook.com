import type { Tx, WaitlistEntry, WaitlistEntryInsert } from "../../db";

import { sql } from "drizzle-orm";
import { SYSTEM_USER } from "../../constants";
import { dbMayFail, txOrDb } from "../../db";
import { waitlistEntrySchema } from "../../db/schema";
import { isError, newError } from "../../errors";
import * as baseModel from "../base";

export const schemaName = "waitlistEntrySchema";

export const dbToModel = (row: WaitlistEntry) => row;

const base = baseModel.getFunctions({ schemaName, dbToModel });

// Staff (global admin) read and remove entries; only the system writes them,
// through `upsertByEmail` below.
export const { get, getById, list, remove } = base;

const t = waitlistEntrySchema;

/**
 * Add `data.email` to the waitlist, or update its entry: a field left out
 * keeps its earlier value. Unscoped, as the system: the public waitlist form
 * is what entitles someone to this (waitlistService.join). `data.email` must
 * already be normalized (trimmed and lowercased).
 */
export const upsertByEmail = async (data: WaitlistEntryInsert, opts: { tx?: Tx } = {}) => {
  const res = await dbMayFail(
    () =>
      txOrDb(opts.tx)
        .insert(t)
        .values({ ...data, createdBy: SYSTEM_USER.id, updatedBy: SYSTEM_USER.id })
        .onConflictDoUpdate({
          target: t.email,
          set: {
            firstName: sql`coalesce(excluded.first_name, ${t.firstName})`,
            caringFor: sql`coalesce(excluded.caring_for, ${t.caringFor})`,
            heardFrom: sql`coalesce(excluded.heard_from, ${t.heardFrom})`,
            source: sql`coalesce(excluded.source, ${t.source})`,
            updatedBy: SYSTEM_USER.id,
            updatedAt: sql`now()`,
          },
        })
        .returning(),
    "waitlistEntryModel:upsertByEmail",
  );
  if (isError(res)) return res;
  const [row] = res;
  return row ? dbToModel(row) : newError({ code: "baseModel:create:nothingCreated" });
};
