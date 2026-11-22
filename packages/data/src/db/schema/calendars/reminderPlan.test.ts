import type { ReminderItem, ReminderMember, PlanRemindersArgs } from "./reminderPlan";

import { describe, expect, it } from "vitest";
import { calendarItems } from "./calendarItems";
import {
  REMINDER_CATCH_UP_MS,
  planReminders,
  readReminderKey,
  reminderKey,
  reminderLeadLabel,
  reminderSendAt,
} from "./reminderPlan";

// planReminders (appointments-2 slice 6): which reminder emails are due
// between the last run and now. The appointments area's clock (Wed
// 2026-11-18 10:00 in Los Angeles) and its zones; names are made up.

const LA = "America/Los_Angeles";
const LONDON = "Europe/London";
const GROUP = "0b7a4c2e-0000-4000-8000-0000000000aa";
const ANA = "0b7a4c2e-0000-4000-8000-0000000000a1";
const BEN = "0b7a4c2e-0000-4000-8000-0000000000b1";
const MADE = "2026-11-01T00:00:00.000Z";

let n = 0;
const nextId = () => `0b7a4c2e-0000-4000-8000-${String(++n).padStart(12, "0")}`;

/** An appointment for Thu 19 Nov 9:00–10:00 in Los Angeles, unless told otherwise. */
const item = (v: Partial<ReminderItem> = {}): ReminderItem => {
  const id = v.source?.id ?? nextId();
  return {
    uid: `entry:${id}`,
    source: { type: "entry", id },
    groupId: GROUP,
    kind: "appointment",
    allDay: false,
    start: "2026-11-19T17:00:00.000Z",
    end: "2026-11-19T18:00:00.000Z",
    timeZone: LA,
    status: "confirmed",
    recipientName: "Pat",
    title: "Dialysis",
    place: null,
    providers: [],
    series: null,
    appUrl: `/app/groups/${GROUP}/entries/${id}`,
    createdAt: MADE,
    ...v,
  };
};

const todoItem = (v: Partial<ReminderItem> = {}): ReminderItem => {
  const id = nextId();
  return item({
    uid: `todo:${id}`,
    source: { type: "todo", id },
    kind: "todo",
    appUrl: `/app/groups/${GROUP}/todos/${id}`,
    ...v,
  });
};

const member = (v: Partial<ReminderMember> = {}): ReminderMember => ({
  userId: ANA,
  remindersOn: true,
  leads: ["eveningBefore", 60],
  timeZone: LA,
  ...v,
});

const plan = (v: Partial<PlanRemindersArgs> & { at: string; since?: string | null }) =>
  planReminders({
    items: [],
    settings: [member()],
    overrides: [],
    assignees: {},
    now: new Date(v.at),
    lastRun: v.since === null ? null : new Date(v.since ?? new Date(Date.parse(v.at) - 60_000).toISOString()),
    ...v,
  });

/** When each lead falls, as ISO, for `it` in `zone` (null: none). */
const sendAt = (it: ReminderItem, lead: Parameters<typeof reminderSendAt>[1], zone = LA) => {
  const at = reminderSendAt(it, lead, zone);
  return at === null ? null : new Date(at).toISOString();
};

describe("reminderSendAt", () => {
  it("puts each lead in the member's zone", () => {
    const visit = item();
    // Los Angeles: 18:00 Wed (PST, UTC−8), 7:00 Thu, and 2 h, 1 h and 30 min before 9:00.
    expect(sendAt(visit, "eveningBefore")).toBe("2026-11-19T02:00:00.000Z");
    expect(sendAt(visit, "morningOf")).toBe("2026-11-19T15:00:00.000Z");
    expect(sendAt(visit, 120)).toBe("2026-11-19T15:00:00.000Z");
    expect(sendAt(visit, 60)).toBe("2026-11-19T16:00:00.000Z");
    expect(sendAt(visit, 30)).toBe("2026-11-19T16:30:00.000Z");
    // London: the visit is at 17:00 Thu there, so the evening before is 18:00 Wed London.
    expect(sendAt(visit, "eveningBefore", LONDON)).toBe("2026-11-18T18:00:00.000Z");
    expect(sendAt(visit, "morningOf", LONDON)).toBe("2026-11-19T07:00:00.000Z");
    expect(sendAt(visit, 60, LONDON)).toBe("2026-11-19T16:00:00.000Z");
  });

  it("follows the clocks over a DST change", () => {
    // Sun 1 Nov 2026, Los Angeles falls back at 2:00 (PDT → PST).
    const sunday = item({ start: "2026-11-01T17:00:00.000Z", end: "2026-11-01T18:00:00.000Z" });
    // 18:00 Sat is still PDT (UTC−7); 7:00 Sun is PST (UTC−8).
    expect(sendAt(sunday, "eveningBefore")).toBe("2026-11-01T01:00:00.000Z");
    expect(sendAt(sunday, "morningOf")).toBe("2026-11-01T15:00:00.000Z");
    // Minutes before are plain minutes, whatever the clocks do.
    const early = item({ start: "2026-11-01T10:30:00.000Z" }); // 2:30 PST
    expect(sendAt(early, 120)).toBe("2026-11-01T08:30:00.000Z"); // 1:30 PDT
    // London's spring change (Sun 29 Mar 2026, 1:00 → 2:00): 7:00 is BST.
    const spring = item({ start: "2026-03-29T09:00:00.000Z", timeZone: LONDON });
    expect(sendAt(spring, "morningOf", LONDON)).toBe("2026-03-29T06:00:00.000Z");
    expect(sendAt(spring, "eveningBefore", LONDON)).toBe("2026-03-28T18:00:00.000Z");
  });

  it("gives an all-day item the evening before or the morning of, and falls back to the evening before", () => {
    const allDay = item({ allDay: true, start: "2026-11-19", end: "2026-11-20" });
    expect(sendAt(allDay, "eveningBefore")).toBe("2026-11-19T02:00:00.000Z");
    expect(sendAt(allDay, "morningOf")).toBe("2026-11-19T15:00:00.000Z");
    expect(sendAt(allDay, 60)).toBe("2026-11-19T02:00:00.000Z");
    expect(sendAt(allDay, 30)).toBe("2026-11-19T02:00:00.000Z");
  });

  it("has no morning-of reminder for something before 7:00", () => {
    const dawn = item({ start: "2026-11-19T14:00:00.000Z" }); // 6:00
    expect(sendAt(dawn, "morningOf")).toBeNull();
    expect(sendAt(dawn, "eveningBefore")).toBe("2026-11-19T02:00:00.000Z");
  });
});

describe("planReminders", () => {
  it("sends nothing for a note, even a stored future one (it gives no calendar item)", () => {
    const note = {
      id: "0b7a4c2e-0000-4000-8000-0000000000c1",
      groupId: GROUP,
      kind: "note" as const,
      occurredAt: "2026-11-19T17:00:00.000Z",
      timeZone: LA,
      endsAt: null,
      allDay: false,
      title: "Call the pharmacy",
      place: null,
      cancelledAt: null,
      deletedAt: null,
      createdAt: MADE,
      seriesId: null,
      seriesDay: null,
      seriesDetached: false,
    };
    const items = calendarItems({
      entries: [note],
      todos: [],
      recipient: { displayName: "Pat", timeZone: LA },
      from: new Date("2026-11-01T00:00:00.000Z"),
      to: new Date("2026-12-31T00:00:00.000Z"),
      appUrl: "https://caretook.example",
    }).map((i) => ({ ...i, createdAt: MADE }));
    expect(items).toEqual([]);
    expect(plan({ items, at: "2026-11-19T16:00:00.000Z" })).toEqual([]);
  });

  it("sends each of a member's leads once its time has come, in their zone", () => {
    const visit = item();
    const at18 = plan({ items: [visit], at: "2026-11-19T02:00:00.000Z" });
    expect(at18.map((s) => [s.userId, s.lead, s.sendAt, s.channel])).toEqual([
      [ANA, "eveningBefore", "2026-11-19T02:00:00.000Z", "email"],
    ]);
    expect(plan({ items: [visit], at: "2026-11-19T01:59:00.000Z" })).toEqual([]);
    expect(plan({ items: [visit], at: "2026-11-19T16:00:00.000Z" }).map((s) => s.lead)).toEqual([60]);
    // Ben, in London, with the morning of and 30 min before.
    const ben = member({ userId: BEN, timeZone: LONDON, leads: ["morningOf", 30] });
    const london = plan({ items: [visit], settings: [ben], at: "2026-11-19T07:00:00.000Z" });
    expect(london.map((s) => [s.userId, s.lead, s.timeZone])).toEqual([[BEN, "morningOf", LONDON]]);
  });

  it("sends only what falls in (lastRun, now], catching up at most 6 h", () => {
    const visit = item();
    // A run exactly at a send, then the next minute: once.
    expect(
      plan({ items: [visit], at: "2026-11-19T02:00:00.000Z", since: "2026-11-19T01:59:00.000Z" }),
    ).toHaveLength(1);
    expect(
      plan({ items: [visit], at: "2026-11-19T02:01:00.000Z", since: "2026-11-19T02:00:00.000Z" }),
    ).toEqual([]);
    // Late by 5 h: still sent.
    expect(
      plan({ items: [visit], at: "2026-11-19T07:00:00.000Z", since: "2026-11-19T01:00:00.000Z" }).map(
        (s) => s.lead,
      ),
    ).toEqual(["eveningBefore"]);
    // Late by more than 6 h: dropped, even with an older last run or none.
    expect(
      plan({ items: [visit], at: "2026-11-19T08:01:00.000Z", since: "2026-11-18T00:00:00.000Z" }),
    ).toEqual([]);
    expect(plan({ items: [visit], at: "2026-11-19T08:01:00.000Z", since: null })).toEqual([]);
    expect(plan({ items: [visit], at: "2026-11-19T07:59:00.000Z", since: null })).toHaveLength(1);
    expect(REMINDER_CATCH_UP_MS).toBe(6 * 60 * 60_000);
  });

  it("sends nothing once the item has started", () => {
    const visit = item();
    // Caught up after the start: the 1 h reminder is no use any more.
    expect(
      plan({ items: [visit], at: "2026-11-19T17:01:00.000Z", since: "2026-11-19T15:00:00.000Z" }),
    ).toEqual([]);
  });

  it("sends an all-day item's fallback once, however many timed leads point at it", () => {
    const allDay = item({ allDay: true, start: "2026-11-19", end: "2026-11-20" });
    const leads = member({ leads: ["eveningBefore", 120, 60] });
    const sends = plan({ items: [allDay], settings: [leads], at: "2026-11-19T02:00:00.000Z" });
    expect(sends.map((s) => s.lead)).toEqual(["eveningBefore"]);
    const morning = member({ leads: ["morningOf"] });
    expect(plan({ items: [allDay], settings: [morning], at: "2026-11-19T15:00:00.000Z" })).toHaveLength(1);
  });

  it("reminds a todo's assignee only: the morning it's due, or 1 h before its time", () => {
    const ben = member({ userId: BEN, leads: [30] });
    const settings = [member(), ben];
    const dayTodo = todoItem({ allDay: true, start: "2026-11-19", end: "2026-11-20" });
    const timedTodo = todoItem({ start: "2026-11-19T21:00:00.000Z", end: "2026-11-19T21:30:00.000Z" });
    const unassigned = todoItem({ allDay: true, start: "2026-11-19", end: "2026-11-20" });
    const assignees = { [dayTodo.source.id]: BEN, [timedTodo.source.id]: BEN, [unassigned.source.id]: null };
    const items = [dayTodo, timedTodo, unassigned];
    const morning = plan({ items, settings, assignees, at: "2026-11-19T15:00:00.000Z" });
    expect(morning.map((s) => [s.userId, s.item.uid, s.lead])).toEqual([[BEN, dayTodo.uid, "morningOf"]]);
    const hourBefore = plan({ items, settings, assignees, at: "2026-11-19T20:00:00.000Z" });
    expect(hourBefore.map((s) => [s.userId, s.item.uid, s.lead])).toEqual([[BEN, timedTodo.uid, 60]]);
    // An assignee who hasn't turned reminders on, or isn't a member any more, gets nothing.
    const off = [member(), member({ userId: BEN, remindersOn: false })];
    expect(plan({ items, settings: off, assignees, at: "2026-11-19T15:00:00.000Z" })).toEqual([]);
    expect(plan({ items, settings: [member()], assignees, at: "2026-11-19T15:00:00.000Z" })).toEqual([]);
  });

  it("adds an override's extra leads and honours a mute, for that member only", () => {
    const visit = item();
    const ben = member({ userId: BEN });
    const overrides = [
      { userId: ANA, entryId: visit.source.id, mode: "extra" as const, leads: [120 as const, 60 as const] },
      { userId: BEN, entryId: visit.source.id, mode: "mute" as const, leads: null },
    ];
    const settings = [member(), ben];
    const twoHours = plan({ items: [visit], settings, overrides, at: "2026-11-19T15:00:00.000Z" });
    expect(twoHours.map((s) => [s.userId, s.lead])).toEqual([[ANA, 120]]);
    const hour = plan({ items: [visit], settings, overrides, at: "2026-11-19T16:00:00.000Z" });
    expect(hour.map((s) => [s.userId, s.lead])).toEqual([[ANA, 60]]);
    const evening = plan({ items: [visit], settings, overrides, at: "2026-11-19T02:00:00.000Z" });
    expect(evening.map((s) => [s.userId, s.lead])).toEqual([[ANA, "eveningBefore"]]);
  });

  it("sends nothing for a cancelled item, to anyone with reminders off, or for a send past when it was made", () => {
    const at = "2026-11-19T16:00:00.000Z";
    expect(plan({ items: [item({ status: "cancelled" })], at })).toEqual([]);
    expect(plan({ items: [item()], settings: [member({ remindersOn: false })], at })).toEqual([]);
    expect(plan({ items: [item()], settings: [], at })).toEqual([]);
    // Made at 8:30 for 9:00: the 1 h reminder (8:00) was already past, even on a late run.
    const late = item({ createdAt: "2026-11-19T16:30:00.000Z" });
    expect(
      plan({ items: [late], at: "2026-11-19T16:31:00.000Z", since: "2026-11-19T15:00:00.000Z" }),
    ).toEqual([]);
  });

  it("keys a send by recipient, item, lead and start, so a moved visit sends again", () => {
    const visit = item();
    const [first] = plan({ items: [visit], at: "2026-11-19T16:00:00.000Z" });
    expect(first?.key).toBe(`reminder:${ANA}:${GROUP}:${visit.uid}:60:2026-11-19T17:00:00.000Z`);
    expect(readReminderKey(first!.key)).toEqual({ userId: ANA, groupId: GROUP });
    // Moved to 10:00: its 1 h reminder is a new send with a new key.
    const moved = { ...visit, start: "2026-11-19T18:00:00.000Z", end: "2026-11-19T19:00:00.000Z" };
    const [again] = plan({
      items: [moved],
      at: "2026-11-19T17:00:00.000Z",
      since: "2026-11-19T16:00:00.000Z",
    });
    expect(again?.key).not.toBe(first?.key);
    expect(again?.key).toBe(
      reminderKey({ userId: ANA, groupId: GROUP, uid: visit.uid, lead: 60, start: moved.start }),
    );
    expect(readReminderKey("invite:abc")).toBeNull();
  });

  it("labels each lead", () => {
    expect(reminderLeadLabel("eveningBefore")).toBe("The evening before, at 18:00");
    expect(reminderLeadLabel("morningOf")).toBe("The morning of, at 7:00");
    expect([120, 60, 30].map((l) => reminderLeadLabel(l as 120 | 60 | 30))).toEqual([
      "2 h before",
      "1 h before",
      "30 min before",
    ]);
  });
});
