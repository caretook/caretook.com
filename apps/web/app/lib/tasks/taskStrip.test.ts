import type { TaskRuleFields } from "@caretook/data/schema";

import { taskOrder } from "@caretook/data/schema";
import { describe, expect, it } from "vitest";
import { taskStrip, taskStripText, taskStripWho } from "./taskStrip";

const LA = "America/Los_Angeles";
// Wednesday, Nov 18, 2026, 10:00 AM in Los Angeles.
const NOW = new Date("2026-11-18T18:00:00.000Z");
const ME = "me";

const task = (
  title: string,
  dueOn: string | null,
  extra: Partial<TaskRuleFields> = {},
): TaskRuleFields & { title: string } => ({
  id: title,
  title,
  assigneeId: null,
  assigneeName: null,
  dueOn,
  dueTime: null,
  doneAt: null,
  createdAt: "2026-11-10T12:00:00.000Z",
  ...extra,
});

const strip = (tasks: ReturnType<typeof task>[], now = NOW) => {
  const s = taskStrip(taskOrder(tasks, now, LA), now, LA, ME);
  return s && { state: s.state, mine: s.mine, more: s.more, ...taskStripText(s) };
};

describe("taskStrip", () => {
  it("is null with nothing overdue or due today", () => {
    expect(strip([])).toBeNull();
    expect(strip([task("Later", "2026-11-19"), task("Someday", null)])).toBeNull();
    expect(strip([task("Done", "2026-11-17", { doneAt: "2026-11-17T20:00:00.000Z" })])).toBeNull();
  });

  it.each([
    {
      name: "the first overdue one, counting today's in +N more",
      tasks: [
        task("Pick up walker", "2026-11-18"),
        task("Call pharmacy", "2026-11-16"),
        task("Fax form", "2026-11-17"),
      ],
      want: {
        state: "overdue",
        title: "Call pharmacy",
        mine: false,
        more: 2,
        text: "Overdue: Call pharmacy · +2 more",
      },
    },
    {
      name: "my overdue one before an earlier one of someone else's",
      tasks: [
        task("Call pharmacy", "2026-11-16", { assigneeId: "sam" }),
        task("Fax form", "2026-11-17", { assigneeId: ME }),
      ],
      want: { state: "overdue", title: "Fax form", mine: true, more: 1, text: "Overdue: Fax form · +1 more" },
    },
    {
      name: "a task due today at a time already past is overdue",
      tasks: [
        task("Pick up walker", "2026-11-18"),
        task("Call before 9", "2026-11-18", { dueTime: "09:00" }),
      ],
      want: {
        state: "overdue",
        title: "Call before 9",
        mine: false,
        more: 1,
        text: "Overdue: Call before 9 · +1 more",
      },
    },
    {
      name: "today's (amber) when nothing is late",
      tasks: [task("Pick up walker", "2026-11-18"), task("Later", "2026-11-20")],
      want: { state: "today", title: "Pick up walker", mine: false, more: 0, text: "Today: Pick up walker" },
    },
    {
      name: "my task today first",
      tasks: [
        task("Pick up walker", "2026-11-18"),
        task("Call at 5", "2026-11-18", { dueTime: "17:00", assigneeId: ME }),
      ],
      want: { state: "today", title: "Call at 5", mine: true, more: 1, text: "Today: Call at 5 · +1 more" },
    },
    {
      name: "a typed-in name's task is never mine",
      tasks: [task("Drive to physio", "2026-11-18", { assigneeName: "me" })],
      want: {
        state: "today",
        title: "Drive to physio",
        mine: false,
        more: 0,
        text: "Today: Drive to physio",
      },
    },
  ])("names $name", ({ tasks, want }) => {
    expect(strip(tasks)).toMatchObject(want);
  });

  it("moves from today to overdue as the day ends in the recipient's zone", () => {
    const tasks = [task("Pick up walker", "2026-11-18")];
    expect(strip(tasks, new Date("2026-11-19T07:59:00.000Z"))?.state).toBe("today"); // 11:59 PM
    expect(strip(tasks, new Date("2026-11-19T08:00:00.000Z"))?.state).toBe("overdue"); // midnight
  });
});

describe("taskStripText and taskStripWho", () => {
  it("splits the line into its parts", () => {
    expect(taskStripText({ state: "overdue", task: { title: "Call pharmacy" }, more: 2 })).toEqual({
      lead: "Overdue",
      title: "Call pharmacy",
      rest: "+2 more",
      text: "Overdue: Call pharmacy · +2 more",
    });
    expect(taskStripText({ state: "today", task: { title: "Pick up walker" }, more: 0 }).rest).toBeNull();
  });

  it("opens the list on Mine for my task, else Everyone", () => {
    expect(taskStripWho({ mine: true })).toBe("mine");
    expect(taskStripWho({ mine: false })).toBe("everyone");
  });
});
