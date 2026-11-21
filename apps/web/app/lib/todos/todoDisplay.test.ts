import { nextOccurrence } from "@caretook/data/series";
import { describe, expect, it } from "vitest";
import { todoRepeatLine } from "./todoDisplay";
import { todoSections } from "./todoList";

const LA = "America/Los_Angeles";
// Friday 2026-11-20, 12:00 in Los Angeles.
const NOW = Date.UTC(2026, 10, 20, 20, 0);

describe("todoRepeatLine", () => {
  const line = (repeatRule: string | null, repeatStartsOn = "2026-11-16") =>
    todoRepeatLine({ repeatRule, repeatStartsOn });

  it("says each pattern", () => {
    expect(line("FREQ=WEEKLY;INTERVAL=1;BYDAY=MO")).toBe("Repeats weekly on Monday");
    expect(line("FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,TH")).toBe("Repeats every 2 weeks on Monday and Thursday");
    expect(line("FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,WE,FR")).toBe(
      "Repeats weekly on Monday, Wednesday and Friday",
    );
    expect(line("FREQ=DAILY;INTERVAL=1")).toBe("Repeats daily");
    expect(line("FREQ=DAILY;INTERVAL=3")).toBe("Repeats every 3 days");
    expect(line("FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=18")).toBe("Repeats monthly on the 18th");
    expect(line("FREQ=MONTHLY;INTERVAL=1;BYDAY=-1FR")).toBe("Repeats monthly on the last Friday");
    expect(line("FREQ=MONTHLY;INTERVAL=3;BYDAY=2TU")).toBe("Repeats every 3 months on the 2nd Tuesday");
  });

  it("says how it ends, with the year only when it's another year's", () => {
    expect(line("FREQ=WEEKLY;INTERVAL=1;BYDAY=MO;UNTIL=20261221")).toBe(
      "Repeats weekly on Monday · until Dec 21",
    );
    expect(line("FREQ=WEEKLY;INTERVAL=1;BYDAY=MO;UNTIL=20270201")).toBe(
      "Repeats weekly on Monday · until Feb 1, 2027",
    );
    expect(line("FREQ=DAILY;INTERVAL=1;COUNT=10")).toBe("Repeats daily · 10 times");
    expect(line("FREQ=DAILY;INTERVAL=1;COUNT=1")).toBe("Repeats daily · 1 time");
  });

  it("is null for a todo that doesn't repeat, and 'Repeats' for a rule it can't read", () => {
    expect(line(null)).toBeNull();
    expect(line("FREQ=YEARLY")).toBe("Repeats");
  });
});

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
    const sections = todoSections([done, other, { ...next!, createdAt: "2026-11-20T20:00:00Z" }], NOW, LA);
    expect(sections.map((s) => [s.label, s.todos.map((t) => t.title)])).toEqual([
      ["Monday, Nov 23", ["Put the bins out"]],
      ["Tuesday, Nov 24", ["Fax the form"]],
    ]);
  });
});
