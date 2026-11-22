import { readFileSync } from "node:fs";
import { sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { createGroup, createUser } from "../../test/fixtures";
import { getDb } from "./client";

// The easy-mode migration's data copy (simple-mode PRD, slice 1): a group's
// saved tiles and a user's own setting read back unchanged through the new
// column and key. Runs the migration's UPDATE statements again on rows that
// still carry only the old column and key, as production rows do.

const migration = readFileSync(new URL("./migrations/0034_many_tony_stark.sql", import.meta.url), "utf8");
const copies = migration
  .split("--> statement-breakpoint")
  .map((statement) => statement.trim())
  .filter((statement) => statement.startsWith("UPDATE"));

describe("the easy-mode migration", () => {
  it("copies a group's tiles and a user's setting to the new column and key", async () => {
    const db = getDb();
    const owner = await createUser("easy-owner");
    const other = await createUser("easy-other");
    const { group } = await createGroup(owner);
    const tiles = { mode: "custom", tiles: [{ kind: "note" }, { kind: "symptom" }] };
    await db.execute(
      sql`UPDATE care_group SET simple_tiles = ${JSON.stringify(tiles)}::jsonb, easy_tiles = NULL WHERE id = ${group.id}`,
    );
    await db.execute(
      sql`UPDATE "user" SET preferences = '{"simpleMode":"simple","units":{}}'::jsonb WHERE id = ${owner.user.id}`,
    );
    await db.execute(
      sql`UPDATE "user" SET preferences = '{"simpleMode":"full"}'::jsonb WHERE id = ${other.user.id}`,
    );

    expect(copies).toHaveLength(2);
    for (const statement of copies) await db.execute(sql.raw(statement));

    const groupRows = await db.execute(sql`SELECT easy_tiles FROM care_group WHERE id = ${group.id}`);
    expect(groupRows.rows[0]?.easy_tiles).toEqual(tiles);
    const prefs = async (id: string) =>
      (await db.execute(sql`SELECT preferences FROM "user" WHERE id = ${id}`)).rows[0]?.preferences;
    expect(await prefs(owner.user.id)).toMatchObject({ easyMode: "easy", units: {} });
    expect(await prefs(other.user.id)).toMatchObject({ easyMode: "full" });
  });
});
