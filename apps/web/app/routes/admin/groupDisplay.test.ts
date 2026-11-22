import { describe, expect, it } from "vitest";
import {
  changeRoleOptions,
  countText,
  dayText,
  groupRoleLabel,
  memberActionText,
  personLabel,
  recipientLabel,
  sortGroupMembers,
} from "./groupDisplay";

describe("groupPage", () => {
  it("labels roles and people", () => {
    expect(groupRoleLabel("caretaker")).toBe("Caretaker");
    expect(groupRoleLabel("future")).toBe("future");
    expect(personLabel({ name: "Ana", email: "ana@example.com" })).toBe("Ana (ana@example.com)");
    expect(personLabel({ name: null, email: "ana@example.com" })).toBe("ana@example.com");
  });

  it("sorts members owners first, then by name", () => {
    const sorted = sortGroupMembers([
      { name: "zed", email: "z@example.com", role: "viewer" },
      { name: null, email: "b@example.com", role: "caretaker" },
      { name: "Al", email: "a@example.com", role: "caretaker" },
      { name: "Oz", email: "o@example.com", role: "owner" },
    ]);
    expect(sorted.map((m) => m.email)).toEqual([
      "o@example.com",
      "a@example.com",
      "b@example.com",
      "z@example.com",
    ]);
  });

  it("offers every settable role but the member's own, never owner", () => {
    expect(changeRoleOptions("caretaker")).toEqual(["admin", "viewer", "easy_helper", "easy_viewer"]);
    expect(changeRoleOptions("owner")).toEqual([
      "admin",
      "caretaker",
      "viewer",
      "easy_helper",
      "easy_viewer",
    ]);
  });

  it("names the recipient, counts and days", () => {
    expect(recipientLabel({ recipientName: "Pat", recipientPreferredName: "Grandma Pat" })).toBe(
      "Pat (Grandma Pat)",
    );
    expect(recipientLabel({ recipientName: "Pat", recipientPreferredName: null })).toBe("Pat");
    expect(recipientLabel({ recipientName: null, recipientPreferredName: null })).toBe("No care recipient");
    expect(countText(1, "entry", "entries")).toBe("1 entry");
    expect(countText(1200, "entry", "entries")).toBe("1,200 entries");
    expect(dayText(null)).toBe("Never");
    expect(dayText("2026-11-19T23:30:00.000Z")).toBe("Nov 19, 2026");
  });

  it("words each member action", () => {
    const ana = { name: "Ana", email: "ana@example.com" };
    expect(memberActionText("promoteOwner", ana, "Pat's care").confirm).toBe("Make owner");
    expect(memberActionText("removeMember", ana, "Pat's care").title).toBe("Remove Ana from Pat's care?");
    expect(memberActionText("changeRole", { name: null, email: "x@example.com" }, "G").title).toBe(
      "Change x@example.com's role?",
    );
  });
});
