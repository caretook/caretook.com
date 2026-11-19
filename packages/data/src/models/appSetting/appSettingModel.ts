import type { AppSetting, Tx } from "../../db";

import { eq, sql } from "drizzle-orm";
import { dbMayFail, txOrDb } from "../../db";
import { appSettingSchema } from "../../db/schema";
import { isError, newError } from "../../errors";

export const schemaName = "appSettingSchema";

export const dbToModel = (row: AppSetting) => row;

// The app settings' stored rows (admin PRD). Unscoped: only
// appSettingService calls it, after its capability check (reads of the
// effective values need no actor: consumers such as sign-up run signed out).

const t = appSettingSchema;

/** Every stored row. */
export const all = async (tx?: Tx) => {
  const rows = await dbMayFail(() => txOrDb(tx).select().from(t), "appSettingModel:all");
  return isError(rows) ? rows : rows.map(dbToModel);
};

/** One key's row, locked `FOR UPDATE` inside `tx` (so two changes to one key queue up). */
export const getForUpdate = async (tx: Tx, key: string) => {
  const rows = await dbMayFail(
    () => tx.select().from(t).where(eq(t.key, key)).for("update"),
    "appSettingModel:get",
  );
  return isError(rows) ? rows : (rows[0] ?? null);
};

/**
 * Store `value` under `key` (insert or replace). A null value (no
 * announcement, the environment's allowlist) is stored as JSON `null`:
 * drizzle would send SQL NULL, which the column refuses.
 */
export const put = async (tx: Tx, key: string, stored: unknown, updatedBy: string | null) => {
  const value = stored === null ? sql`'null'::jsonb` : stored;
  const res = await dbMayFail(
    () =>
      tx
        .insert(t)
        .values({ key, value, updatedBy })
        .onConflictDoUpdate({ target: t.key, set: { value, updatedBy, updatedAt: new Date().toISOString() } })
        .returning(),
    "appSettingModel:put",
  );
  if (isError(res)) return res;
  return res[0] ? dbToModel(res[0]) : newError({ code: "baseModel:create:nothingCreated" });
};
