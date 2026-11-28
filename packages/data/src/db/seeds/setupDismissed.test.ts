import type { GroupSetupEntry } from "../schema";

import { describe, expect, it } from "vitest";
import { dismissalsToAdd } from "./setupDismissed";

const A = "0b6f3c1e-5d1a-4c2e-9a77-3f1d2b8c0001";
const B = "0b6f3c1e-5d1a-4c2e-9a77-3f1d2b8d0001";
const DONE: GroupSetupEntry = { opened: true, retired: ["help", "entry"] };

describe("dismissalsToAdd", () => {
  it("gives a member all their seeded groups, dismissed and set up", () => {
    expect(
      dismissalsToAdd([
        { userId: "u", groupId: A, dismissed: undefined },
        { userId: "u", groupId: B, dismissed: undefined },
      ]),
    ).toEqual([{ userId: "u", setupDismissed: [A, B], groupSetup: { [A]: DONE, [B]: DONE } }]);
  });

  it("keeps what's already dismissed and changes nothing on a second run", () => {
    expect(dismissalsToAdd([{ userId: "u", groupId: B, dismissed: [A] }])).toEqual([
      { userId: "u", setupDismissed: [A, B], groupSetup: { [B]: DONE } },
    ]);
    expect(
      dismissalsToAdd([{ userId: "u", groupId: B, dismissed: [A, B], groupSetup: { [B]: DONE } }]),
    ).toEqual([]);
  });

  it("adds the setup record beside a dismissal from before it, keeping other groups' records", () => {
    const other = { [A]: { retired: ["help"] } } satisfies Record<string, GroupSetupEntry>;
    expect(dismissalsToAdd([{ userId: "u", groupId: B, dismissed: [B], groupSetup: other }])).toEqual([
      { userId: "u", setupDismissed: [B], groupSetup: { ...other, [B]: DONE } },
    ]);
  });
});
