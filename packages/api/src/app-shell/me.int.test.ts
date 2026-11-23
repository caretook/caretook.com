import type { UserPreferences } from "@caretook/data";

import { describe, expect, it } from "vitest";
import { createUser } from "../../../data/test/fixtures";
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
