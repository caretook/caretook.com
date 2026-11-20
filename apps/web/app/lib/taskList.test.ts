import { describe, expect, it } from "vitest";
import { defaultWho, parseWho, setWho, showsTask, taskSections } from "./taskList";

const LA = "America/Los_Angeles";
// Friday 2026-11-20, 12:00 in Los Angeles.
const NOW = Date.UTC(2026, 10, 20, 20, 0);
const ME = "u-me";
const SAM = "u-sam";

const task = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  assigneeId: null as string | null,
  assigneeName: null as string | null,
  dueOn: null as string | null,
  dueTime: null as string | null,
  doneAt: null as string | null,
  createdAt: "2026-11-01T00:00:00Z",
  ...overrides,
});

describe("the chip", () => {
  it("reads and writes ?who=", () => {
    expect(parseWho("?who=mine")).toBe("mine");
    expect(parseWho("?who=unassigned")).toBe("unassigned");
    expect(parseWho("?who=bogus")).toBeNull();
    expect(parseWho("")).toBeNull();
    expect(setWho("?x=1", "everyone")).toBe("?x=1&who=everyone");
  });

  it("defaults to Mine when I have open tasks, else Everyone", () => {
    expect(defaultWho([task("a", { assigneeId: ME })], ME)).toBe("mine");
    expect(defaultWho([task("a", { assigneeId: ME, doneAt: "2026-11-19T00:00:00Z" })], ME)).toBe("everyone");
    expect(defaultWho([task("a", { assigneeId: SAM })], ME)).toBe("everyone");
    expect(defaultWho([], ME)).toBe("everyone");
  });

  it("shows a typed name's task under Everyone only", () => {
    const typed = task("a", { assigneeName: "Aunt May" });
    expect(showsTask("everyone", typed, ME)).toBe(true);
    expect(showsTask("unassigned", typed, ME)).toBe(false);
    expect(showsTask("mine", typed, ME)).toBe(false);
    expect(showsTask("unassigned", task("b"), ME)).toBe(true);
    expect(showsTask("mine", task("c", { assigneeId: ME }), ME)).toBe(true);
    expect(showsTask("mine", task("d", { assigneeId: SAM }), ME)).toBe(false);
  });
});

describe("taskSections", () => {
  it("is Overdue, Today, a day per later day, then No due date, without done tasks", () => {
    const sections = taskSections(
      [
        task("undated"),
        task("mon", { dueOn: "2026-11-23" }),
        task("tomorrow", { dueOn: "2026-11-21" }),
        task("today", { dueOn: "2026-11-20", dueTime: "15:00" }),
        task("late-today", { dueOn: "2026-11-20", dueTime: "08:00" }),
        task("late", { dueOn: "2026-11-18" }),
        task("done", { dueOn: "2026-11-18", doneAt: "2026-11-19T00:00:00Z" }),
      ],
      NOW,
      LA,
    );
    expect(sections.map((s) => [s.label, s.tasks.map((t) => t.id)])).toEqual([
      ["Overdue", ["late", "late-today"]],
      ["Today", ["today"]],
      ["Tomorrow", ["tomorrow"]],
      ["Monday, Nov 23", ["mon"]],
      ["No due date", ["undated"]],
    ]);
  });

  it("is empty with nothing open", () => {
    expect(taskSections([], NOW, LA)).toEqual([]);
  });
});
