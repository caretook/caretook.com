import type { TodoRuleFields } from "@caretook/data/schema";

import { todoOrder } from "@caretook/data/schema";
import { describe, expect, it } from "vitest";
import { todoStrip, todoStripText, todoStripWho } from "./todoStrip";

const LA = "America/Los_Angeles";
// Wednesday, Nov 18, 2026, 10:00 AM in Los Angeles.
const NOW = new Date("2026-11-18T18:00:00.000Z");
const ME = "me";

const todo = (
  title: string,
  dueOn: string | null,
  extra: Partial<TodoRuleFields> = {},
): TodoRuleFields & { title: string } => ({
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

const strip = (todos: ReturnType<typeof todo>[], now = NOW) => {
  const s = todoStrip(todoOrder(todos, now, LA), now, LA, ME);
  return s && { state: s.state, mine: s.mine, more: s.more, ...todoStripText(s) };
};

describe("todoStrip", () => {
  it("is null with nothing overdue or due today", () => {
    expect(strip([])).toBeNull();
    expect(strip([todo("Later", "2026-11-19"), todo("Someday", null)])).toBeNull();
    expect(strip([todo("Done", "2026-11-17", { doneAt: "2026-11-17T20:00:00.000Z" })])).toBeNull();
  });

  it.each([
    {
      name: "the first overdue one, counting today's in +N more",
      todos: [
        todo("Pick up walker", "2026-11-18"),
        todo("Call pharmacy", "2026-11-16"),
        todo("Fax form", "2026-11-17"),
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
      todos: [
        todo("Call pharmacy", "2026-11-16", { assigneeId: "sam" }),
        todo("Fax form", "2026-11-17", { assigneeId: ME }),
      ],
      want: { state: "overdue", title: "Fax form", mine: true, more: 1, text: "Overdue: Fax form · +1 more" },
    },
    {
      name: "a todo due today at a time already past is overdue",
      todos: [
        todo("Pick up walker", "2026-11-18"),
        todo("Call before 9", "2026-11-18", { dueTime: "09:00" }),
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
      todos: [todo("Pick up walker", "2026-11-18"), todo("Later", "2026-11-20")],
      want: { state: "today", title: "Pick up walker", mine: false, more: 0, text: "Today: Pick up walker" },
    },
    {
      name: "my todo today first",
      todos: [
        todo("Pick up walker", "2026-11-18"),
        todo("Call at 5", "2026-11-18", { dueTime: "17:00", assigneeId: ME }),
      ],
      want: { state: "today", title: "Call at 5", mine: true, more: 1, text: "Today: Call at 5 · +1 more" },
    },
    {
      name: "a typed-in name's todo is never mine",
      todos: [todo("Drive to physio", "2026-11-18", { assigneeName: "me" })],
      want: {
        state: "today",
        title: "Drive to physio",
        mine: false,
        more: 0,
        text: "Today: Drive to physio",
      },
    },
  ])("names $name", ({ todos, want }) => {
    expect(strip(todos)).toMatchObject(want);
  });

  it("moves from today to overdue as the day ends in the recipient's zone", () => {
    const todos = [todo("Pick up walker", "2026-11-18")];
    expect(strip(todos, new Date("2026-11-19T07:59:00.000Z"))?.state).toBe("today"); // 11:59 PM
    expect(strip(todos, new Date("2026-11-19T08:00:00.000Z"))?.state).toBe("overdue"); // midnight
  });
});

describe("todoStripText and todoStripWho", () => {
  it("splits the line into its parts", () => {
    expect(todoStripText({ state: "overdue", todo: { title: "Call pharmacy" }, more: 2 })).toEqual({
      lead: "Overdue",
      title: "Call pharmacy",
      rest: "+2 more",
      text: "Overdue: Call pharmacy · +2 more",
    });
    expect(todoStripText({ state: "today", todo: { title: "Pick up walker" }, more: 0 }).rest).toBeNull();
  });

  it("opens the list on Mine for my todo, else Everyone", () => {
    expect(todoStripWho({ mine: true })).toBe("mine");
    expect(todoStripWho({ mine: false })).toBe("everyone");
  });
});

describe("todoStrip and the tree (todo-subtasks-2)", () => {
  const step = (title: string, dueOn: string | null, extra: Partial<TodoRuleFields> = {}) => ({
    ...todo(title, dueOn, extra),
    parentId: "Parent",
  });

  it("drops an undated, unassigned subtask and keeps a dated or assigned one", () => {
    expect(todoStrip([step("Plain step", null)], NOW, LA, ME)).toBeNull();
    const s = todoStrip(
      [
        step("Late step", "2026-11-17"),
        step("My step", "2026-11-17", { assigneeId: ME }),
        step("Plain step", null),
      ],
      NOW,
      LA,
      ME,
    );
    expect(s && { title: s.todo.title, mine: s.mine, more: s.more, overdue: s.overdue }).toEqual({
      title: "My step",
      mine: true,
      more: 1,
      overdue: 2,
    });
  });
});
