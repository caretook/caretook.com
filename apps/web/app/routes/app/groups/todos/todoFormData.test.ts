import { ruleText } from "@caretook/data/schema";
import { describe, expect, it } from "vitest";
import { choiceRule } from "../../../../lib/appointments/repeatChoice";
import { initialRepeat, isFieldIssue, prefillRepeat, repeatOnDay, todoFromForm } from "./todoFormData";

const form = (entries: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.set(k, v);
  return f;
};

describe("todoFromForm", () => {
  it("reads the fields, empty ones as none", () => {
    expect(
      todoFromForm(
        form({
          title: "Call",
          assigneeId: "",
          assigneeName: " Aunt May ",
          dueOn: "2026-11-20",
          dueTime: "",
          providerId: "p1",
          medicationId: "",
          eventId: "e1",
          repeatRule: "FREQ=WEEKLY;INTERVAL=1;BYDAY=FR",
          entryId: "n1",
        }),
      ),
    ).toEqual({
      title: "Call",
      assigneeId: null,
      assigneeName: "Aunt May",
      dueOn: "2026-11-20",
      dueTime: null,
      providerId: "p1",
      medicationId: null,
      eventId: "e1",
      repeatRule: "FREQ=WEEKLY;INTERVAL=1;BYDAY=FR",
      entryId: "n1",
    });
    expect(todoFromForm(form({}))).toEqual({
      title: "",
      assigneeId: null,
      assigneeName: null,
      dueOn: null,
      dueTime: null,
      providerId: null,
      medicationId: null,
      eventId: null,
      repeatRule: null,
      entryId: null,
    });
  });

  it("knows which issues the fields show", () => {
    expect(isFieldIssue("dueTime")).toBe(true);
    expect(isFieldIssue("providerId")).toBe(true);
    expect(isFieldIssue("repeatRule")).toBe(true);
    expect(isFieldIssue("groupId")).toBe(false);
  });
});

describe("the repeat", () => {
  const LAST_FRIDAY = "FREQ=MONTHLY;INTERVAL=1;BYDAY=-1FR";

  it("starts from an edited todo's stored rule, as is", () => {
    // The 27th is the last Friday, though the day alone would say the 4th.
    const draft = initialRepeat({ repeatRule: LAST_FRIDAY, dueOn: "2026-11-27" });
    expect(draft?.rule).toBe(LAST_FRIDAY);
    expect(draft?.choice).toMatchObject({ preset: "monthly", monthlyBy: "weekday" });
    expect(repeatOnDay(draft, "2026-11-27")).toBe(draft);
    expect(initialRepeat({ repeatRule: null, dueOn: "2026-11-27" })).toBeNull();
    expect(initialRepeat(undefined)).toBeNull();
  });

  it("keeps a last-Friday rule through the Repeat sheet's Done on a 4th Friday (B-393)", () => {
    // The 27th is the last Friday of November 2026, and also its 4th: Done
    // without a change must not turn -1FR into 4FR.
    const draft = initialRepeat({ repeatRule: LAST_FRIDAY, dueOn: "2026-11-27" });
    const rule = draft && choiceRule(draft.choice, draft.day);
    expect(rule && ruleText(rule)).toBe(LAST_FRIDAY);
  });

  it("clears with the due day, and follows a new one", () => {
    const draft = initialRepeat({ repeatRule: "FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=18", dueOn: "2026-11-18" });
    expect(repeatOnDay(draft, "")).toBeNull();
    expect(repeatOnDay(draft, "2026-11-20")).toMatchObject({
      rule: "FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=20",
      day: "2026-11-20",
    });
    const weekly = initialRepeat({ repeatRule: "FREQ=WEEKLY;INTERVAL=1;BYDAY=MO", dueOn: "2026-11-16" });
    expect(repeatOnDay(weekly, "2026-11-17")?.rule).toBe("FREQ=WEEKLY;INTERVAL=1;BYDAY=MO");
    expect(repeatOnDay(null, "2026-11-17")).toBeNull();
  });

  it("starts a new todo from quick entry's repeat, ignoring one that doesn't parse (planner-3)", () => {
    const weekly = "FREQ=WEEKLY;INTERVAL=1;BYDAY=MO";
    expect(prefillRepeat(weekly, "2026-11-23")).toMatchObject({
      rule: weekly,
      day: "2026-11-23",
      choice: { preset: "weekly", weekdays: ["MO"] },
    });
    expect(prefillRepeat("FREQ=YEARLY", "2026-11-23")).toBeNull();
    expect(prefillRepeat("every monday", "2026-11-23")).toBeNull();
    expect(prefillRepeat(weekly, null)).toBeNull();
    expect(prefillRepeat(null, "2026-11-23")).toBeNull();
  });
});
