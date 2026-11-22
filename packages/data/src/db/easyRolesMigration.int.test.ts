import { readFileSync } from "node:fs";
import { sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { createGroup, createUser } from "../../test/fixtures";
import { getDb } from "./client";

// The easy roles' conversion (simple-mode PRD, slice 3): members locked in easy mode become an easy role
// when they were a caretaker or a viewer; locked owners and admins keep theirs, and unlocked members are
// untouched. Runs the migration's statements again on rows set up as production had them.

const migration = readFileSync(new URL("./migrations/0036_easy_roles.sql", import.meta.url), "utf8");
const statements = migration
  .split("--> statement-breakpoint")
  .map((statement) =>
    statement
      .split("\n")
      .filter((line) => !line.startsWith("--"))
      .join("\n")
      .trim(),
  )
  .filter(Boolean);

describe("the easy roles migration", () => {
  it("turns locked caretakers and viewers into easy roles, and leaves everyone else", async () => {
    const db = getDb();
    const people = {
      owner: await createUser("conv-owner"),
      admin: await createUser("conv-admin"),
      caretaker: await createUser("conv-caretaker"),
      viewer: await createUser("conv-viewer"),
      freeCaretaker: await createUser("conv-free-caretaker"),
      freeViewer: await createUser("conv-free-viewer"),
      defaultOnly: await createUser("conv-default-only"),
    };
    const { group } = await createGroup(people.owner, [
      { user: people.admin.user, role: "admin" },
      { user: people.caretaker.user, role: "caretaker" },
      { user: people.viewer.user, role: "viewer" },
      { user: people.freeCaretaker.user, role: "caretaker" },
      { user: people.freeViewer.user, role: "viewer" },
      { user: people.defaultOnly.user, role: "viewer" },
    ]);
    for (const who of [people.owner, people.admin, people.caretaker, people.viewer])
      await db.execute(
        sql`UPDATE care_group_member SET simple_mode = true, simple_mode_locked = true
            WHERE group_id = ${group.id} AND user_id = ${who.user.id}`,
      );
    // The managers' default alone never locked anyone.
    await db.execute(
      sql`UPDATE care_group_member SET simple_mode = true WHERE group_id = ${group.id} AND user_id = ${people.defaultOnly.user.id}`,
    );

    expect(statements.filter((s) => s.startsWith('UPDATE "care_group_member"'))).toHaveLength(2);
    for (const statement of statements) await db.execute(sql.raw(statement));

    const rows = await db.execute<{ user_id: string; role: string }>(
      sql`SELECT user_id, role FROM care_group_member WHERE group_id = ${group.id}`,
    );
    const roleOf = (who: keyof typeof people) =>
      rows.rows.find((r) => r.user_id === people[who].user.id)?.role;
    expect(roleOf("owner")).toBe("owner");
    expect(roleOf("admin")).toBe("admin");
    expect(roleOf("caretaker")).toBe("easy_helper");
    expect(roleOf("viewer")).toBe("easy_viewer");
    expect(roleOf("freeCaretaker")).toBe("caretaker");
    expect(roleOf("freeViewer")).toBe("viewer");
    expect(roleOf("defaultOnly")).toBe("viewer");
  });

  it("drops a stored “follow the group” setting and keeps the others", async () => {
    const db = getDb();
    const following = await createUser("conv-following");
    const easy = await createUser("conv-easy");
    await db.execute(
      sql`UPDATE "user" SET preferences = '{"easyMode":"group","timelineView":"cards"}'::jsonb WHERE id = ${following.user.id}`,
    );
    await db.execute(
      sql`UPDATE "user" SET preferences = '{"easyMode":"easy"}'::jsonb WHERE id = ${easy.user.id}`,
    );

    for (const statement of statements) await db.execute(sql.raw(statement));

    const prefs = async (id: string) =>
      (await db.execute(sql`SELECT preferences FROM "user" WHERE id = ${id}`)).rows[0]?.preferences;
    expect(await prefs(following.user.id)).toEqual({ timelineView: "cards" });
    expect(await prefs(easy.user.id)).toEqual({ easyMode: "easy" });
  });
});
