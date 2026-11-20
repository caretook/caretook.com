import type { TaskRuleFields } from "@caretook/data/schema";
import type { UpcomingDose } from "./upcomingDoses";

import { describe, expect, it } from "vitest";
import { upcomingSections } from "./upcomingDays";
import { withDueDoses } from "./upcomingDoses";
import { isUpcomingTask, showsTasks, upcomingTasks, withDueTasks } from "./upcomingTasks";

const LA = "America/Los_Angeles";
const NY = "America/New_York";
// Wednesday, Nov 18, 2026, 10:00 AM in Los Angeles.
const NOW = new Date("2026-11-18T18:00:00.000Z");

const task = (
  id: string,
  dueOn: string | null,
  dueTime: string | null = null,
  extra: Partial<TaskRuleFields> = {},
) => ({
  id,
  assigneeId: null,
  assigneeName: null,
  dueOn,
  dueTime,
  doneAt: null,
  createdAt: "2026-11-10T12:00:00.000Z",
  ...extra,
});

type Item = { id: string; occurredAt: string; timeZone: string; allDay?: boolean; endsAt?: string | null };
const entry = (id: string, occurredAt: string, extra: Partial<Item> = {}): Item => ({
  id,
  occurredAt,
  timeZone: LA,
  ...extra,
});
const dose = (key: string, at: string): UpcomingDose => ({
  type: "dueDose",
  key,
  passId: null,
  medicationId: "m",
  title: "Metformin",
  count: 1,
  time: "00:00",
  at,
  state: "upcoming",
});

const keyOf = (i: object) => ("key" in i ? (i as { key: string }).key : (i as Item).id);
const shape = (sections: { label: string; items: object[] }[]) =>
  sections.map((s) => [s.label, s.items.map(keyOf)]);

describe("upcomingTasks", () => {
  it("keeps open dated tasks in the order given, with their state and the moment a timed one falls", () => {
    const items = upcomingTasks(
      [
        task("late", "2026-11-16"),
        task("today", "2026-11-18", "17:00"),
        task("later", "2026-11-20"),
        task("undated", null),
        task("done", "2026-11-18", null, { doneAt: "2026-11-18T17:00:00.000Z" }),
      ],
      NOW,
      LA,
    );
    expect(items.map((i) => [i.key, i.state, i.at])).toEqual([
      ["task:late", "overdue", null],
      ["task:today", "today", "2026-11-19T01:00:00.000Z"],
      ["task:later", "upcoming", null],
    ]);
    expect(items.every(isUpcomingTask)).toBe(true);
  });

  it("a task due today at a time already past is overdue", () => {
    expect(upcomingTasks([task("t", "2026-11-18", "09:00")], NOW, LA)[0]?.state).toBe("overdue");
  });
});

describe("withDueTasks", () => {
  const place = (
    entries: Item[],
    tasks: ReturnType<typeof task>[],
    { doses = [] as UpcomingDose[], viewer = LA, recipient = LA, now = NOW } = {},
  ) =>
    shape(
      withDueTasks(
        withDueDoses(upcomingSections(entries, now, viewer), doses, now, viewer),
        upcomingTasks(tasks, now, recipient),
        now,
        viewer,
        recipient,
      ),
    );

  it("puts overdue tasks first under Today, never under Now", () => {
    const visit = entry("visit", "2026-11-18T17:30:00.000Z", { endsAt: "2026-11-18T19:00:00.000Z" });
    const lunch = entry("lunch", "2026-11-18T20:00:00.000Z");
    expect(
      place(
        [visit, lunch],
        [task("a", "2026-11-15"), task("b", "2026-11-17"), task("c", "2026-11-18", "08:00")],
      ),
    ).toEqual([
      ["Now", ["visit"]],
      ["Today", ["task:a", "task:b", "task:c", "lunch"]],
    ]);
  });

  it("makes a Today section for an overdue task when nothing else is today, after Now and before later days", () => {
    const visit = entry("visit", "2026-11-18T17:30:00.000Z", { endsAt: "2026-11-18T19:00:00.000Z" });
    const friday = entry("friday", "2026-11-20T18:00:00.000Z");
    expect(place([visit, friday], [task("a", "2026-11-17")])).toEqual([
      ["Now", ["visit"]],
      ["Today", ["task:a"]],
      ["Friday, Nov 20", ["friday"]],
    ]);
  });

  it("within a day: all-day entries, then all-day tasks, then timed items by time (a task after an item at the same time)", () => {
    const allDay = entry("allday", "2026-11-20T08:00:00.000Z", { allDay: true });
    const nine = entry("nine", "2026-11-20T17:00:00.000Z"); // 9:00 AM
    const noon = entry("noon", "2026-11-20T20:00:00.000Z"); // 12:00 PM
    expect(
      place(
        [allDay, nine, noon],
        [
          task("at-noon", "2026-11-20", "12:00"),
          task("at-ten", "2026-11-20", "10:00"),
          task("whole-day", "2026-11-20"),
        ],
      ),
    ).toEqual([
      ["Friday, Nov 20", ["allday", "task:whole-day", "nine", "task:at-ten", "noon", "task:at-noon"]],
    ]);
  });

  it("sits among due doses by time", () => {
    const doses = [dose("m@12:00", "2026-11-18T20:00:00.000Z"), dose("m@20:00", "2026-11-19T04:00:00.000Z")];
    expect(place([], [task("five", "2026-11-18", "17:00")], { doses })).toEqual([
      ["Today", ["m@12:00", "task:five", "m@20:00"]],
    ]);
  });

  it("gives a day with only tasks its own section, in day order", () => {
    const monday = entry("monday", "2026-11-23T18:00:00.000Z");
    expect(place([monday], [task("tomorrow", "2026-11-19"), task("sat", "2026-11-21", "09:00")])).toEqual([
      ["Tomorrow", ["task:tomorrow"]],
      ["Saturday, Nov 21", ["task:sat"]],
      ["Monday, Nov 23", ["monday"]],
    ]);
  });

  it("keeps the given order among tasks at the same place", () => {
    expect(place([], [task("first", "2026-11-19"), task("second", "2026-11-19")])).toEqual([
      ["Tomorrow", ["task:first", "task:second"]],
    ]);
  });

  it("places a timed task by the moment it falls where the viewer is; an all-day one on its own day", () => {
    // Recipient in New York: 23:30 there on Thursday is 8:30 PM Thursday in LA,
    // and 00:30 Friday there is 9:30 PM Thursday in LA.
    expect(
      place(
        [],
        [
          task("late-thu", "2026-11-19", "23:30"),
          task("fri-early", "2026-11-20", "00:30"),
          task("fri", "2026-11-20"),
        ],
        {
          recipient: NY,
        },
      ),
    ).toEqual([
      ["Tomorrow", ["task:late-thu", "task:fri-early"]],
      ["Friday, Nov 20", ["task:fri"]],
    ]);
  });

  it("puts nothing in Now and leaves the sections alone with no tasks", () => {
    const visit = entry("visit", "2026-11-18T17:30:00.000Z", { endsAt: "2026-11-18T19:00:00.000Z" });
    expect(place([visit], [])).toEqual([["Now", ["visit"]]]);
  });
});

describe("showsTasks", () => {
  it("shows tasks only without a kind or author filter", () => {
    expect(showsTasks({})).toBe(true);
    expect(showsTasks({ kind: null, author: null })).toBe(true);
    expect(showsTasks({ kind: "event" })).toBe(false);
    expect(showsTasks({ author: "u1" })).toBe(false);
  });
});
