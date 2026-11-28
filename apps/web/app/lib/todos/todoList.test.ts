import { describe, expect, it } from "vitest";
import {
  clearWho,
  emptyTodosText,
  parseWho,
  setTodoQuery,
  setWho,
  showsTodo,
  TODO_WHO,
  todoQueryOf,
  todoSections,
  whoOf,
} from "./todoList";
import { todoTrees } from "./todoTreeView";

const LA = "America/Los_Angeles";
// Friday 2026-11-20, 12:00 in Los Angeles.
const NOW = Date.UTC(2026, 10, 20, 20, 0);
const ME = "u-me";
const SAM = "u-sam";

const todo = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  assigneeId: null as string | null,
  assigneeName: null as string | null,
  dueOn: null as string | null,
  dueTime: null as string | null,
  doneAt: null as string | null,
  createdAt: "2026-11-01T00:00:00Z",
  ...overrides,
});

type Todo = ReturnType<typeof todo>;
/** The trees `todoTrees` builds, sectioned. */
const sectionsOf = (todos: Todo[], matches?: (t: Todo) => boolean) =>
  todoSections(todoTrees(todos, { now: NOW, timeZone: LA, matches }), NOW, LA);
/** A tree as nested ids: `[id, [children…]]`, a context row's id in brackets. */
type Shape = [string, Shape[]];
type Node = { todo: Todo; context: boolean; children: Node[] };
const shape = (node: Node): Shape => [
  node.context ? `(${node.todo.id})` : node.todo.id,
  node.children.map(shape),
];

describe("the chip", () => {
  it("reads and writes ?who=", () => {
    expect(parseWho("?who=mine")).toBe("mine");
    expect(parseWho("?who=unassigned")).toBe("unassigned");
    expect(parseWho("?who=bogus")).toBeNull();
    expect(parseWho("")).toBeNull();
    expect(setWho("?x=1", "everyone")).toBe("?x=1&who=everyone");
  });

  it("defaults to Everyone, first in the menu; an explicit ?who= wins", () => {
    expect(TODO_WHO).toEqual(["everyone", "mine", "unassigned"]);
    expect(whoOf("")).toBe("everyone");
    expect(whoOf("?who=bogus")).toBe("everyone");
    expect(whoOf("?who=mine")).toBe("mine");
    expect(whoOf("?who=unassigned")).toBe("unassigned");
  });

  it("clears ?who= and keeps the rest", () => {
    expect(clearWho("?who=mine")).toBe("");
    expect(clearWho("?x=1&who=mine")).toBe("?x=1");
    expect(clearWho("")).toBe("");
  });

  it("shows a typed name's todo under Everyone only", () => {
    const typed = todo("a", { assigneeName: "Aunt May" });
    expect(showsTodo("everyone", typed, ME)).toBe(true);
    expect(showsTodo("unassigned", typed, ME)).toBe(false);
    expect(showsTodo("mine", typed, ME)).toBe(false);
    expect(showsTodo("unassigned", todo("b"), ME)).toBe(true);
    expect(showsTodo("mine", todo("c", { assigneeId: ME }), ME)).toBe(true);
    expect(showsTodo("mine", todo("d", { assigneeId: SAM }), ME)).toBe(false);
  });
});

describe("todoSections", () => {
  it("is Overdue, Today, a day per later day, then No due date, without done todos", () => {
    const sections = sectionsOf([
      todo("undated"),
      todo("mon", { dueOn: "2026-11-23" }),
      todo("tomorrow", { dueOn: "2026-11-21" }),
      todo("today", { dueOn: "2026-11-20", dueTime: "15:00" }),
      todo("late-today", { dueOn: "2026-11-20", dueTime: "08:00" }),
      todo("late", { dueOn: "2026-11-18" }),
      todo("done", { dueOn: "2026-11-18", doneAt: "2026-11-19T00:00:00Z" }),
    ]);
    expect(sections.map((s) => [s.label, s.trees.map((t) => t.todo.id)])).toEqual([
      ["Overdue", ["late", "late-today"]],
      ["Today", ["today"]],
      ["Tomorrow", ["tomorrow"]],
      ["Monday, Nov 23", ["mon"]],
      ["No due date", ["undated"]],
    ]);
  });

  it("is empty with nothing open", () => {
    expect(sectionsOf([])).toEqual([]);
  });

  it("sections trees: a subtask never sections alone, dated or assigned, and a done one stays in its tree (todo-subtasks-3)", () => {
    const sections = sectionsOf([
      todo("parent"),
      todo("plain-step", { parentId: "parent" }),
      todo("dated-step", { parentId: "parent", dueOn: "2026-11-21" }),
      todo("mine-step", { parentId: "parent", assigneeId: ME }),
      todo("done-step", { parentId: "parent", doneAt: "2026-11-19T00:00:00Z" }),
      todo("sub-step", { parentId: "dated-step" }),
      todo("other"),
    ]);
    // The tree goes under its most urgent open todo's day: the dated step's.
    expect(sections.map((s) => [s.label, s.trees.map(shape)])).toEqual([
      [
        "Tomorrow",
        [
          [
            "parent",
            [
              ["dated-step", [["sub-step", []]]],
              ["done-step", []],
              ["mine-step", []],
              ["plain-step", []],
            ],
          ],
        ],
      ],
      ["No due date", [["other", []]]],
    ]);
  });

  it("a filter keeps a matching subtask in its tree, its parent as context; a tree with nothing open matching is left out", () => {
    const sections = sectionsOf(
      [
        todo("parent"),
        todo("mine-step", { parentId: "parent", assigneeId: ME }),
        todo("sams-step", { parentId: "parent", assigneeId: SAM }),
        todo("errand"),
        todo("mine-done", { parentId: "errand", assigneeId: ME, doneAt: "2026-11-19T00:00:00Z" }),
      ],
      (t) => showsTodo("mine", t, ME),
    );
    expect(sections.map((s) => [s.label, s.trees.map(shape)])).toEqual([
      ["No due date", [["(parent)", [["mine-step", []]]]]],
    ]);
  });
});

describe("the quick text filter", () => {
  it("reads and writes ?q=, trimmed, keeping the rest", () => {
    expect(todoQueryOf("?who=mine&q=%20fax%20")).toBe("fax");
    expect(todoQueryOf("")).toBe("");
    expect(setTodoQuery("?who=mine", " fax ")).toBe("?who=mine&q=fax");
    expect(setTodoQuery("?who=mine&q=fax", "")).toBe("?who=mine");
    expect(setTodoQuery("?q=fax", " ")).toBe("");
  });

  it("an empty list names the filter and the text", () => {
    expect(emptyTodosText("everyone")).toBe("No open todos.");
    expect(emptyTodosText("mine", "fax")).toBe("Nothing assigned to you matching “fax”.");
    expect(emptyTodosText("unassigned", "fax")).toBe("No unassigned todos matching “fax”.");
  });
});
