import { describe, expect, it } from "vitest";
import { emergencyOrder, emergencyOrderZSchema, emergencyRanks } from "./emergencyContacts";

const A = "0b6f3c1e-0000-4000-8000-00000000000a";
const B = "0b6f3c1e-0000-4000-8000-00000000000b";
const N = "0b6f3c1e-0000-4000-8000-00000000000c";

describe("emergency order", () => {
  it("merges members and outside contacts by rank, leaving out the unranked", () => {
    const order = emergencyOrder(
      [
        { userId: A, emergencyRank: 2 },
        { userId: B, emergencyRank: null },
      ],
      [{ id: N, emergencyRank: 1 }],
    );
    expect(order).toEqual([
      { kind: "outside", id: N },
      { kind: "member", userId: A },
    ]);
  });

  it("puts members first on a tied rank, and keeps gaps in order", () => {
    const order = emergencyOrder(
      [
        { userId: A, emergencyRank: 5 },
        { userId: B, emergencyRank: 2 },
      ],
      [{ id: N, emergencyRank: 2 }],
    );
    expect(order.map((r) => (r.kind === "member" ? r.userId : r.id))).toEqual([B, N, A]);
  });

  it("numbers a list 1…n", () => {
    const ranks = emergencyRanks([
      { kind: "member", userId: A },
      { kind: "outside", id: N },
    ]);
    expect([...ranks]).toEqual([
      [`member:${A}`, 1],
      [`outside:${N}`, 2],
    ]);
  });

  it("refuses a contact listed twice, or an unknown kind", () => {
    expect(
      emergencyOrderZSchema.safeParse([
        { kind: "member", userId: A },
        { kind: "member", userId: A },
      ]).success,
    ).toBe(false);
    expect(emergencyOrderZSchema.safeParse([{ kind: "user", userId: A }]).success).toBe(false);
    expect(emergencyOrderZSchema.safeParse([]).success).toBe(true);
  });
});
