import type { UserPreferences } from "@caretook/data";

import { getDb, userService } from "@caretook/data";
import { describe, expect, it } from "vitest";
import { createGroup, createUser, ok } from "../../../data/test/fixtures";
import { clientFor } from "../testing";

const GROUP_A = "0b6f3c1e-5d1a-4c2e-9a77-3f1d2b8d0a01";
const GROUP_B = "0b6f3c1e-5d1a-4c2e-9a77-3f1d2b8d0a02";

/** One save per field, so a lost update shows up as a field gone. */
const SAVES: UserPreferences[] = [
  { timelineView: "cards" },
  { daySummary: "off" },
  { easyMode: "easy" },
  { units: { temperature: "c" } },
  { units: { weight: "kg" } },
  { setupDismissed: [GROUP_A] },
  { setupDismissed: [GROUP_B] },
];

const expectAllKept = (preferences: UserPreferences) => {
  expect(preferences).toMatchObject({
    timelineView: "cards",
    daySummary: "off",
    easyMode: "easy",
    units: { temperature: "c", weight: "kg" },
  });
  expect([...(preferences.setupDismissed ?? [])].sort()).toEqual([GROUP_A, GROUP_B]);
};

describe("me.setAvatar", () => {
  it("sets and clears only your own choice", async () => {
    const mine = await createUser("avatar-mine");
    const other = await createUser("avatar-other");
    const api = clientFor(mine.ctx.authUser);

    expect((await api.me.setAvatar({ color: "jade", icon: "bird" })).avatar).toEqual({
      color: "jade",
      icon: "bird",
    });
    expect((await api.me.get()).avatar).toEqual({ color: "jade", icon: "bird" });
    expect((await clientFor(other.ctx.authUser).me.get()).avatar).toEqual({ color: null, icon: null });

    await api.me.setAvatar({ color: null, icon: null });
    expect((await api.me.get()).avatar).toEqual({ color: null, icon: null });
  });

  it.each([
    ["an unknown color", { color: "red", icon: null }],
    ["an unknown icon", { color: null, icon: "pill" }],
    ["a URL", { color: null, icon: "https://example.com/me.png" }],
    ["another user's id", { color: null, icon: null, userId: GROUP_A }],
  ])("refuses %s", async (_name, input) => {
    const { ctx } = await createUser(`avatar-bad-${_name.replace(/\W/g, "")}`);
    const api = clientFor(ctx.authUser);
    await expect(api.me.setAvatar(input as never)).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect((await api.me.get()).avatar).toEqual({ color: null, icon: null });
  });

  it("is refused by the database too", async () => {
    const { ctx } = await createUser("avatar-db");
    const set = (column: "avatar_color" | "avatar_icon") =>
      getDb().$client.query(`UPDATE "user" SET ${column} = 'nope' WHERE id = $1`, [ctx.authUser.id]);
    await expect(set("avatar_color")).rejects.toThrow();
    await expect(set("avatar_icon")).rejects.toThrow();
  });

  it("shows a co-member both ids, and never their email or preferences", async () => {
    const owner = await createUser("avatar-owner");
    const viewer = await createUser("avatar-viewer");
    await createGroup(owner, [{ user: viewer.user, role: "viewer" }]);
    await clientFor(owner.ctx.authUser).me.setAvatar({ color: "sky", icon: "cat" });
    const seen = ok(await userService.getById(viewer.ctx, owner.user.id));
    expect(seen).toEqual({
      id: owner.user.id,
      name: owner.user.name,
      image: null,
      avatarColor: "sky",
      avatarIcon: "cat",
      publicOnly: true,
    });
  });

  it("leaves every other table in the publication", async () => {
    const { rows } = await getDb().$client.query<{ tablename: string }>(
      `SELECT tablename FROM pg_publication_tables WHERE pubname = 'powersync'`,
    );
    const tables = rows.map((r) => r.tablename);
    expect(tables).toEqual(
      expect.arrayContaining([
        "user",
        "care_group",
        "care_group_member",
        "timeline_entry",
        "todo",
        "provider",
      ]),
    );
  });
});

describe("me.updatePreferences at the same moment", () => {
  it("keeps every change on a first save", async () => {
    const { ctx } = await createUser("first-save");
    const api = clientFor(ctx.authUser);
    await Promise.all(SAVES.map((save) => api.me.updatePreferences(save)));
    expectAllKept((await api.me.get()).preferences);
  });

  it("keeps every change on a row that already has preferences, and what it had", async () => {
    const { ctx } = await createUser("existing");
    const api = clientFor(ctx.authUser);
    await api.me.updatePreferences({ units: { glucose: "mmol/L" } });
    await Promise.all(SAVES.map((save) => api.me.updatePreferences(save)));
    const { preferences } = await api.me.get();
    expectAllKept(preferences);
    expect(preferences.units?.glucose).toBe("mmol/L");
  });
});
