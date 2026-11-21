import { readFileSync } from "node:fs";
import { sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { createGroup, createUser } from "../../../test/fixtures";
import { getDb } from "../client";
import { SYNC_CONFIG_PATH } from "./applyRoles";
import { parseYaml } from "./syncConfig";

// The `care_group_writers` stream (the recipient's sensitive details) as
// PowerSync evaluates it for each member: its `writer_groups` query from
// the real sync-config.yaml, run on the test database with the member as
// `auth.user_id()`. Owners, admins and caretakers get the group; viewers and
// both easy roles never do (easy roles PRD). Fictional data.

const writerGroupsQuery = () => {
  const root = parseYaml(readFileSync(SYNC_CONFIG_PATH, "utf8")) as {
    streams: { care_group_writers: { with: { writer_groups: string } } };
  };
  return root.streams.care_group_writers.with.writer_groups;
};

/** The groups the stream gives `userId` (a fixture's UUID, so safe to inline). */
const writerGroupsOf = async (userId: string) => {
  if (!/^[0-9a-f-]{36}$/.test(userId)) throw new Error("not a UUID");
  const query = writerGroupsQuery().replace("auth.user_id()", `'${userId}'`);
  if (query.includes("auth.")) throw new Error("unexpected auth parameter in writer_groups");
  const rows = await getDb().execute<{ group_id: string }>(sql.raw(query));
  return rows.rows.map((r) => r.group_id);
};

describe("the care_group_writers stream", () => {
  it("reaches owners, admins and caretakers, never viewers or the easy roles", async () => {
    const owner = await createUser("owner");
    const others = {
      admin: await createUser("admin"),
      caretaker: await createUser("caretaker"),
      viewer: await createUser("viewer"),
      easy_helper: await createUser("easy-helper"),
      easy_viewer: await createUser("easy-viewer"),
    };
    const { group } = await createGroup(
      owner,
      (Object.keys(others) as (keyof typeof others)[]).map((role) => ({ user: others[role].user, role })),
    );
    expect(await writerGroupsOf(owner.user.id)).toEqual([group.id]);
    expect(await writerGroupsOf(others.admin.user.id)).toEqual([group.id]);
    expect(await writerGroupsOf(others.caretaker.user.id)).toEqual([group.id]);
    for (const role of ["viewer", "easy_helper", "easy_viewer"] as const)
      expect({ role, groups: await writerGroupsOf(others[role].user.id) }).toEqual({ role, groups: [] });
  });
});
