import { nextOccurrence } from "@caretook/data/series";
import { describe, expect, it } from "vitest";
import { todoSections } from "./todoList";
import { todoTrees } from "./todoTreeView";

const LA = "America/Los_Angeles";
// Friday 2026-11-20, 12:00 in Los Angeles.
const NOW = Date.UTC(2026, 10, 20, 20, 0);

describe("where the next occurrence sorts", () => {
  const weekly = {
    id: "0b6f3c1e-5d1a-4c2e-9a77-3f1d2be09001",
    groupId: "g",
    recipientId: "r",
    title: "Put the bins out",
    assigneeId: null,
    assigneeName: null,
    // Monday this week: overdue on Friday.
    dueOn: "2026-11-16",
    dueTime: "19:00",
    providerId: null,
    medicationId: null,
    repeatRule: "FREQ=WEEKLY;INTERVAL=1;BYDAY=MO",
    repeatStartsOn: "2026-11-16",
    repeatId: "0b6f3c1e-5d1a-4c2e-9a77-3f1d2be09001",
    doneAt: null as string | null,
    createdAt: "2026-11-01T00:00:00Z",
  };
  const other = { ...weekly, id: "other", title: "Fax the form", dueOn: "2026-11-24", repeatRule: null };

  it("ticked late, the next one is under next Monday's heading, not Overdue", () => {
    const next = nextOccurrence(weekly, "2026-11-20");
    expect(next?.dueOn).toBe("2026-11-23");
    const done = { ...weekly, doneAt: "2026-11-20T20:00:00Z" };
    const todos = [done, other, { ...next!, createdAt: "2026-11-20T20:00:00Z" }];
    const sections = todoSections(todoTrees(todos, { now: NOW, timeZone: LA }), NOW, LA);
    expect(sections.map((s) => [s.label, s.trees.map((t) => t.todo.title)])).toEqual([
      ["Monday, Nov 23", ["Put the bins out"]],
      ["Tuesday, Nov 24", ["Fax the form"]],
    ]);
  });
});
