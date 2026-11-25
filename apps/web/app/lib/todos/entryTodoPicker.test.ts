import type { PickerTodo } from "./entryTodoPicker";

import { describe, expect, it } from "vitest";
import { todoPickerOptions } from "./entryTodoPicker";

const ZONE = "America/Los_Angeles";
// Wed 2026-11-25, 10:00 in the zone.
const NOW = Date.parse("2026-11-25T18:00:00.000Z");

const t = (id: string, title: string, extra: Partial<PickerTodo> = {}): PickerTodo => ({
  id,
  title,
  assigneeId: null,
  assigneeName: null,
  dueOn: null,
  dueTime: null,
  doneAt: null,
  createdAt: "2026-11-01T00:00:00.000Z",
  deletedAt: null,
  ...extra,
});

const later = t("a", "Book the follow-up", { dueOn: "2026-11-28" });
const overdue = t("b", "Call the pharmacy", { dueOn: "2026-11-24" });
const undated = t("c", "Find the insurance card");
const done = t("d", "Fax the referral", { doneAt: "2026-11-20T12:00:00.000Z" });
const gone = t("e", "Deleted one", { deletedAt: "2026-11-20T12:00:00.000Z" });
const tomorrow = t("f", "Ask about the Café hours", { dueOn: "2026-11-26" });
const all = [later, overdue, undated, done, gone, tomorrow];

const ids = (text = "", linked: string[] = [], limit?: number) =>
  todoPickerOptions(all, new Set(linked), text, NOW, ZONE, limit).map((o) => o.id);

describe("todoPickerOptions", () => {
  it("lists open, live todos in list order: overdue, then by day, undated last", () => {
    expect(ids()).toEqual(["b", "f", "a", "c"]);
  });

  it("leaves out todos already linked to the entry", () => {
    expect(ids("", ["b", "c"])).toEqual(["f", "a"]);
  });

  it("matches every typed word in the title, case and accents ignored", () => {
    expect(ids("PHARMACY")).toEqual(["b"]);
    expect(ids("the card")).toEqual(["c"]);
    expect(ids("cafe")).toEqual(["f"]);
    expect(ids("nothing like it")).toEqual([]);
    // Done and deleted todos never match.
    expect(ids("fax")).toEqual([]);
    expect(ids("deleted")).toEqual([]);
  });

  it("stops at the limit", () => {
    expect(ids("", [], 2)).toEqual(["b", "f"]);
  });

  it("names each by its title and says when it's due", () => {
    const options = todoPickerOptions(all, new Set(), "", NOW, ZONE);
    expect(options.find((o) => o.id === "b")).toEqual({
      id: "b",
      label: "Call the pharmacy",
      description: "Overdue · 1 day",
    });
    expect(options.find((o) => o.id === "c")?.description).toBe("No due date");
    expect(options.find((o) => o.id === "f")?.description).toBe("Due tomorrow");
  });
});
