import type { SyncDb } from "~/lib/sync";
import type { Fixture } from "./fixtures";

import { DrizzleAppSchema, wrapPowerSyncWithDrizzle } from "@powersync/drizzle-driver";
import { PowerSyncDatabase } from "@powersync/web";
import { drizzleSchema } from "~/lib/sync/schema";

// The test device's database: a real PowerSync database with the device
// schema, in this Chromium tab, that never connects (no connector, so
// nothing downloads and nothing uploads). Local writes still go through
// PowerSync's views and queue in `ps_crud`, as on a phone that's offline.

const AppSchema = new DrizzleAppSchema(drizzleSchema);

/** A fresh, empty local-only database for `userId`. Close it with `db.powersync.close()`. */
export const openTestDatabase = async (userId: string): Promise<SyncDb> => {
  const powersync = new PowerSyncDatabase({
    schema: AppSchema,
    database: {
      // Its own file per test: nothing carries over between tests.
      dbFilename: `test-device-${crypto.randomUUID()}.sqlite`,
      // In the page itself: no shared worker to outlive the test, no tab locks.
      enableMultiTabs: false,
      useWebWorker: false,
    },
  });
  await powersync.init();
  return { userId, powersync, drizzle: wrapPowerSyncWithDrizzle(powersync, { schema: drizzleSchema }) };
};

/**
 * Rows as if they had synced down: written straight into PowerSync's
 * storage tables (`ps_data__<table>`), the way a download lands, so they
 * queue no upload and fire the same change notifications. One transaction.
 */
export const syncDown = async (db: SyncDb, fixtures: readonly Fixture[]) => {
  if (fixtures.length === 0) return;
  await db.powersync.writeTransaction(async (tx) => {
    for (const { table, row } of fixtures) {
      await tx.execute(`INSERT OR REPLACE INTO ps_data__${table} (id, data) VALUES (?, ?)`, [
        row.id,
        JSON.stringify(row),
      ]);
    }
  });
};

/** Rows removed as a download would remove them (the row left the user's buckets). */
export const syncRemove = async (db: SyncDb, fixtures: readonly Pick<Fixture, "table" | "id">[]) => {
  await db.powersync.writeTransaction(async (tx) => {
    for (const { table, id } of fixtures)
      await tx.execute(`DELETE FROM ps_data__${table} WHERE id = ?`, [id]);
  });
};

/** The writes this device has queued for upload, oldest first (what PowerSync would send). */
export const queuedWrites = async (db: SyncDb) => {
  const rows = await db.powersync.getAll<{ data: string }>("SELECT data FROM ps_crud ORDER BY id");
  return rows.map(
    (r) =>
      JSON.parse(r.data) as {
        op: "PUT" | "PATCH" | "DELETE";
        type: string;
        id: string;
        data?: Record<string, unknown>;
      },
  );
};
