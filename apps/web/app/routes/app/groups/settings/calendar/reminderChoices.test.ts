import { describe, expect, it } from "vitest";
import { leadChoices, withLead } from "./reminderChoices";

describe("the Reminders card's leads", () => {
  it("labels each lead and holds the others back once three are picked", () => {
    const two = leadChoices(["eveningBefore", 60]);
    expect(two.map((c) => [c.label, c.checked, c.disabled])).toEqual([
      ["The evening before, at 18:00", true, false],
      ["The morning of, at 7:00", false, false],
      ["2 h before", false, false],
      ["1 h before", true, false],
      ["30 min before", false, false],
    ]);
    const three = leadChoices(["eveningBefore", 120, 60]);
    expect(three.filter((c) => c.disabled).map((c) => c.lead)).toEqual(["morningOf", 30]);
  });

  it("adds and removes a lead in order, and never past three", () => {
    expect(withLead(["eveningBefore", 60], 30, true)).toEqual(["eveningBefore", 60, 30]);
    expect(withLead([60, "eveningBefore"], "morningOf", true)).toEqual(["eveningBefore", "morningOf", 60]);
    expect(withLead(["eveningBefore", 60], 60, false)).toEqual(["eveningBefore"]);
    expect(withLead(["eveningBefore", 120, 60], 30, true)).toEqual(["eveningBefore", 120, 60]);
  });
});
