import type { PreviewContext } from "./quickEntryPreview";

import { describe, expect, test } from "vitest";
import { actionPreview, whenText } from "./quickEntryPreview";

const NOW = new Date("2026-11-19T16:00:00Z"); // Thu 8:00 in Los Angeles
const MED = "11111111-1111-4111-8111-111111111111";
const LEE = "55555555-5555-4555-8555-555555555555";

const context: PreviewContext = {
  units: { temperature: "f", weight: "lb", glucose: "mg/dL", volume: "mL" },
  now: NOW,
  medications: new Map([[MED, { name: "Metformin", strength: "500 mg" }]]),
  providers: new Map([[LEE, { name: "Dr. Sandra Lee" }]]),
  locale: "en-US",
  timeZone: "America/Los_Angeles",
};
const at = NOW.toISOString();

describe("actionPreview", () => {
  test("vitals read as the timeline shows them, in the user's units", () => {
    expect(
      actionPreview(
        {
          type: "logVital",
          readings: [
            { type: "bloodPressure", systolic: 130, diastolic: 85 },
            { type: "heartRate", value: 72 },
            { type: "temperature", value: 37.2778 },
          ],
          occurredAt: at,
        },
        context,
      ),
    ).toEqual({ title: "BP 130/85 mmHg, HR 72 bpm, Temp 99.1 °F", detail: null, when: "Now" });
  });

  test("a symptom with its severity and note", () => {
    expect(
      actionPreview(
        { type: "logSymptom", name: "Pain", severity: 4, note: "left knee", occurredAt: at },
        context,
      ),
    ).toEqual({ title: "Pain 4", detail: "left knee", when: "Now" });
    expect(actionPreview({ type: "logSymptom", name: "Dizzy", occurredAt: at }, context).title).toBe("Dizzy");
  });

  test("a dose names its medication and what happened", () => {
    expect(
      actionPreview(
        { type: "logDose", medicationId: MED, status: "given", amount: "1 tablet", occurredAt: at },
        context,
      ),
    ).toEqual({ title: "Metformin 500 mg", detail: "Given 1 tablet", when: "Now" });
    expect(
      actionPreview(
        { type: "logDose", medicationId: MED, status: "refused", note: "spat it out", occurredAt: at },
        context,
      ).detail,
    ).toBe("Refused · spat it out");
  });

  test("a pass's Given all names the pass and how many are left", () => {
    const PASS = "77777777-7777-4777-8777-777777777777";
    const passes = new Map([[PASS, { name: "Evening", open: 4 }]]);
    expect(actionPreview({ type: "givePass", passId: PASS, occurredAt: at }, { ...context, passes })).toEqual(
      {
        title: "Evening medications",
        detail: "Given all · 4 medications",
        when: "Now",
      },
    );
    expect(actionPreview({ type: "givePass", passId: PASS, occurredAt: at }, context)).toMatchObject({
      title: "Medications",
      detail: "Given all",
    });
  });

  test("an event with its place and providers", () => {
    expect(
      actionPreview(
        {
          type: "addEvent",
          title: "Event with Dr. Sandra Lee",
          occurredAt: "2026-11-24T22:00:00.000Z",
          allDay: false,
          place: "12 River Rd",
          providerIds: [LEE],
          timeZone: "America/Los_Angeles",
        },
        context,
      ),
    ).toEqual({
      title: "Event with Dr. Sandra Lee",
      detail: "12 River Rd · with Dr. Sandra Lee",
      when: "Tuesday, Nov 24 2:00 PM",
    });
  });

  test("a note is its text", () => {
    expect(
      actionPreview({ type: "addNote", text: "Good day", occurredAt: at, providerIds: [] }, context),
    ).toEqual({ title: "Good day", detail: null, when: "Now" });
  });

  test("a note names the providers it mentions", () => {
    const note = { type: "addNote", text: "called @Dr. Sandra Lee about refill", occurredAt: at } as const;
    expect(actionPreview({ ...note, providerIds: [LEE] }, context)).toEqual({
      title: "called @Dr. Sandra Lee about refill",
      detail: "with Dr. Sandra Lee",
      when: "Now",
    });
    // With a title, the text comes first; an unknown id is left out.
    expect(
      actionPreview(
        { ...note, title: "Refill", providerIds: [LEE, "99999999-9999-4999-8999-999999999999"] },
        context,
      ).detail,
    ).toBe("called @Dr. Sandra Lee about refill · with Dr. Sandra Lee");
  });

  test("a todo is its title, its due in the recipient's zone and its assignee", () => {
    const SAM = "77777777-7777-4777-8777-777777777777";
    const withMembers = { ...context, members: new Map([[SAM, { name: "Sam Rivera" }]]) };
    const todo = { type: "addTodo", title: "Call pharmacy" } as const;
    expect(actionPreview({ ...todo, dueOn: "2026-11-20", assigneeId: SAM }, withMembers)).toEqual({
      title: "Call pharmacy",
      detail: "Sam Rivera",
      when: "Due tomorrow",
    });
    expect(actionPreview({ ...todo, dueOn: "2026-11-23", dueTime: "14:00" }, withMembers)).toMatchObject({
      detail: null,
      when: "Due Mon 14:00",
    });
    expect(actionPreview(todo, withMembers).when).toBe("No due date");
    // The recipient's day, not the device's: 16:00 UTC is already Friday in Tokyo.
    expect(
      actionPreview({ ...todo, dueOn: "2026-11-20" }, { ...withMembers, recipientTimeZone: "Asia/Tokyo" })
        .when,
    ).toBe("Due today");
  });

  test("a repeating todo says its repeat after the due (planner-3)", () => {
    const todo = { type: "addTodo", title: "Bins out", dueOn: "2026-11-23" } as const;
    expect(actionPreview({ ...todo, repeatRule: "FREQ=WEEKLY;INTERVAL=1;BYDAY=MO" }, context).when).toBe(
      "Due Mon · Repeats weekly on Monday",
    );
    expect(
      actionPreview(
        { ...todo, dueTime: "07:00", repeatRule: "FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,WE,FR" },
        context,
      ).when,
    ).toBe("Due Mon 07:00 · Repeats weekly on Monday, Wednesday and Friday");
    expect(
      actionPreview({ ...todo, dueOn: "2026-11-19", repeatRule: "FREQ=DAILY;INTERVAL=2" }, context).when,
    ).toBe("Due today · Repeats every 2 days");
    expect(
      actionPreview(
        { ...todo, dueOn: "2026-12-15", repeatRule: "FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=15" },
        context,
      ).when,
    ).toBe("Due Dec 15 · Repeats monthly on the 15th");
    // No repeat: the due alone.
    expect(actionPreview({ ...todo, repeatRule: null }, context).when).toBe("Due Mon");
  });
});

describe("whenText", () => {
  test.each([
    ["2026-11-19T16:01:00Z", false, "Now"],
    ["2026-11-19T15:30:00Z", false, "7:30 AM"],
    ["2026-11-19T05:00:00Z", false, "Yesterday 9:00 PM"],
    ["2026-11-20T08:00:00Z", true, "Tomorrow · All day"],
    ["2026-11-24T22:00:00Z", false, "Tuesday, Nov 24 2:00 PM"],
  ])("%s (all day: %s) → %s", (iso, allDay, text) => {
    expect(whenText(iso, { now: NOW, locale: "en-US", timeZone: "America/Los_Angeles", allDay })).toBe(text);
  });
});
