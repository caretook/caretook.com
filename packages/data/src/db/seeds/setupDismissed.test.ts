import { describe, expect, it } from "vitest";
import { dismissalsToAdd } from "./setupDismissed";

const A = "0b6f3c1e-5d1a-4c2e-9a77-3f1d2b8c0001";
const B = "0b6f3c1e-5d1a-4c2e-9a77-3f1d2b8d0001";

describe("dismissalsToAdd", () => {
  it("gives a member all their seeded groups", () => {
    expect(
      dismissalsToAdd([
        { userId: "u", groupId: A, dismissed: undefined },
        { userId: "u", groupId: B, dismissed: undefined },
      ]),
    ).toEqual([{ userId: "u", setupDismissed: [A, B] }]);
  });

  it("keeps what's already dismissed and changes nothing on a second run", () => {
    expect(dismissalsToAdd([{ userId: "u", groupId: B, dismissed: [A] }])).toEqual([
      { userId: "u", setupDismissed: [A, B] },
    ]);
    expect(dismissalsToAdd([{ userId: "u", groupId: B, dismissed: [A, B] }])).toEqual([]);
  });
});
