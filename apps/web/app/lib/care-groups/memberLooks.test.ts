import type { LookMember } from "./memberLooks";

import { AVATAR_COLORS } from "@caretook/data/schema";
import { describe, expect, it } from "vitest";
import { resolveMemberLooks } from "./memberLooks";

const member = (n: number, v: Partial<LookMember> = {}): LookMember => ({
  userId: `user-${n}`,
  membershipId: `membership-${n}`,
  joinedAt: `2027-01-${String(n + 1).padStart(2, "0")} 09:00:00`,
  color: null,
  icon: null,
  ...v,
});
const group = (count: number) => Array.from({ length: count }, (_, n) => member(n));
const colors = (members: readonly LookMember[]) =>
  new Map([...resolveMemberLooks(members)].map(([id, look]) => [id, look.color ?? look.defaultColor]));
const moved = (before: Map<string, string>, after: Map<string, string>) =>
  [...before].filter(([id, color]) => after.has(id) && after.get(id) !== color).map(([id]) => id);
/** Everyone's hashed color: each alone in a group. */
const hashed = (m: LookMember) => colors([{ ...m, color: null }]).get(m.userId)!;

describe("resolveMemberLooks", () => {
  it("gives the same answer for any input order", () => {
    const members = [...group(8), member(8, { color: "jade" }), member(9, { icon: "cat" })];
    const expected = colors(members);
    expect(colors([...members].reverse())).toEqual(expected);
    expect(colors([...members.slice(5), ...members.slice(0, 5)])).toEqual(expected);
  });

  it("gives up to ten members distinct colors", () => {
    for (let count = 1; count <= 10; count++) expect(new Set(colors(group(count)).values()).size).toBe(count);
  });

  it("reserves chosen colors, even for someone who joined later", () => {
    const first = member(0);
    const taken = hashed(first);
    const looks = colors([first, member(1, { color: taken })]);
    expect(looks.get("user-1")).toBe(taken);
    expect(looks.get("user-0")).not.toBe(taken);
  });

  it("lets two members who chose the same color keep it", () => {
    const looks = colors([member(0, { color: "sky" }), member(1, { color: "sky" })]);
    expect([...looks.values()]).toEqual(["sky", "sky"]);
  });

  it("a joiner with no chosen color moves nobody", () => {
    const before = group(9);
    expect(moved(colors(before), colors([...before, member(9)]))).toEqual([]);
  });

  it("a joiner with a chosen color moves only its holder and whoever that shift pushes on", () => {
    const before = group(9);
    const was = colors(before);
    for (const holder of before) {
      const taken = was.get(holder.userId)!;
      const after = colors([...before, member(9, { color: taken })]);
      const shifted = before.filter((m) => after.get(m.userId) !== was.get(m.userId));
      expect(shifted[0]?.userId).toBe(holder.userId);
      // Each later move was forced: an earlier mover landed on that member's old color.
      shifted.slice(1).forEach((m, i) => {
        const earlier = shifted.slice(0, i + 1).map((e) => after.get(e.userId));
        expect(earlier).toContain(was.get(m.userId));
      });
    }
  });

  it("a leaver moves only members who had been pushed off their hashed color", () => {
    const members = group(10);
    const was = colors(members);
    for (const leaver of members) {
      const rest = members.filter((m) => m !== leaver);
      for (const id of moved(was, colors(rest))) {
        const m = members.find((x) => x.userId === id)!;
        expect(was.get(id)).not.toBe(hashed(m));
      }
    }
  });

  it("past ten, colors repeat and each extra member takes their hashed color", () => {
    const members = group(13);
    const looks = colors(members);
    expect(new Set(looks.values()).size).toBe(AVATAR_COLORS.length);
    for (const extra of members.slice(10)) expect(looks.get(extra.userId)).toBe(hashed(extra));
  });

  it("breaks a join-time tie on membership id", () => {
    const joinedAt = "2027-01-01 09:00:00";
    const twin = (id: string, userId: string) => member(0, { membershipId: id, userId, joinedAt });
    // Two ids that hash to the same color, so the tie decides who keeps it.
    const ids = Array.from({ length: 200 }, (_, n) => `m-${String(n).padStart(3, "0")}`);
    const target = hashed(twin(ids[0]!, "probe"));
    const [a, b] = ids.filter((id) => hashed(twin(id, "probe")) === target);
    const looks = colors([twin(b!, "second"), twin(a!, "first")]);
    expect(looks.get("first")).toBe(target);
    expect(looks.get("second")).not.toBe(target);
  });

  it("sorts a member whose join time hasn't synced after everyone else", () => {
    const ids = Array.from({ length: 200 }, (_, n) => `m-${String(n).padStart(3, "0")}`);
    const target = hashed(member(0, { membershipId: ids[0]! }));
    const [a, b] = ids.filter((id) => hashed(member(0, { membershipId: id })) === target);
    // `a` sorts first by id, but has no join time yet, so `b` keeps the color.
    const looks = colors([
      member(0, { userId: "unsynced", membershipId: a!, joinedAt: null }),
      member(1, { userId: "joined", membershipId: b! }),
    ]);
    expect(looks.get("joined")).toBe(target);
    expect(looks.get("unsynced")).not.toBe(target);
  });

  it("reads an unknown color or icon as unset", () => {
    const look = resolveMemberLooks([member(0, { color: "ultraviolet", icon: "dragon" })]).get("user-0")!;
    expect(look.color).toBeNull();
    expect(look.icon).toBeNull();
    expect(AVATAR_COLORS).toContain(look.defaultColor);
  });
});
