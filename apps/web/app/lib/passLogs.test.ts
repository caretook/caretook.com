import type { TimelineEntryDetails, TimelineEntryKind } from "@caretook/data/schema";

import { describe, expect, it } from "vitest";
import { passLogText } from "./medicationDisplay";
import { groupPassLogs, passLogCounts, passLogIdOf, rowPassLogId, wholeLogsPage } from "./passLogs";

const MED = (n: number) => `00000000-0000-4000-8000-00000000000${n}`;
const MORNING = "11111111-1111-4111-8111-111111111111";
const LOG_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const LOG_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

type E = {
  id: string;
  kind: TimelineEntryKind;
  details: TimelineEntryDetails | null;
  occurredAt: string;
  medication?: { id: string; name: string; strength: string | null; deletedAt: string | null };
};

const dose = (
  id: string,
  time: string,
  opts: { log?: string; pass?: string; status?: "given" | "skipped" | "refused"; med?: string } = {},
): E => ({
  id,
  kind: "dose",
  occurredAt: `2026-11-17T${time}:00.000Z`,
  details: {
    medicationId: MED(1),
    status: opts.status ?? "given",
    ...(opts.log && { passLogId: opts.log }),
    ...(opts.pass && { passId: opts.pass }),
  },
  medication: { id: MED(1), name: opts.med ?? id, strength: null, deletedAt: null },
});
const note = (id: string, time: string): E => ({
  id,
  kind: "note",
  occurredAt: `2026-11-17T${time}:00.000Z`,
  details: null,
});

const shape = (items: ReturnType<typeof groupPassLogs<E>>) =>
  items.map((i) =>
    i.type === "entry" ? i.entry.id : `${i.id.slice(0, 1)}[${i.entries.map((e) => e.id).join(",")}]`,
  );

describe("passLogIdOf and rowPassLogId", () => {
  it("reads a dose's round, and nothing else's", () => {
    expect(passLogIdOf(dose("d", "08:00", { log: LOG_A }))).toBe(LOG_A);
    expect(passLogIdOf(dose("d", "08:00"))).toBeNull();
    expect(passLogIdOf(note("n", "08:00"))).toBeNull();
    expect(rowPassLogId({ kind: "dose", details: JSON.stringify({ passLogId: LOG_A }) })).toBe(LOG_A);
    expect(rowPassLogId({ kind: "dose", details: "{}" })).toBeNull();
    expect(rowPassLogId({ kind: "dose", details: "not json" })).toBeNull();
    expect(rowPassLogId({ kind: "note", details: JSON.stringify({ passLogId: LOG_A }) })).toBeNull();
  });
});

describe("groupPassLogs", () => {
  it("folds a round into one item at its earliest dose, everything else in place", () => {
    const items = groupPassLogs([
      note("n2", "09:00"),
      dose("d3", "08:05", { log: LOG_A, pass: MORNING, med: "Metformin" }),
      dose("d2", "08:02", { log: LOG_A, pass: MORNING, med: "Lisinopril" }),
      note("n1", "08:03"),
      dose("d1", "08:02", { log: LOG_A, pass: MORNING, med: "Aspirin" }),
      dose("solo", "07:00"),
    ]);
    // The log sits at 08:02, below the 08:03 note; doses earliest first, then by name.
    expect(shape(items)).toEqual(["n2", "n1", "a[d1,d2,d3]", "solo"]);
    const log = items[2]!;
    expect(log.type === "passLog" && log.occurredAt).toBe("2026-11-17T08:02:00.000Z");
    expect(log.type === "passLog" && log.passId).toBe(MORNING);
  });

  it("keeps a dose logged on its own, and a lone dose at a time of its own, as entries", () => {
    expect(shape(groupPassLogs([dose("a", "08:00"), dose("b", "07:00", { log: LOG_A })]))).toEqual([
      "a",
      "b",
    ]);
  });

  it("folds a named pass's log even with one dose (more can be added to it)", () => {
    expect(shape(groupPassLogs([dose("a", "08:00", { log: LOG_A, pass: MORNING })]))).toEqual(["a[a]"]);
  });

  it("keeps two logs apart, and a log with no pass but several doses folds", () => {
    const items = groupPassLogs([
      dose("b2", "20:01", { log: LOG_B }),
      dose("b1", "20:00", { log: LOG_B }),
      dose("a1", "08:00", { log: LOG_A, pass: MORNING }),
      dose("a2", "08:00", { log: LOG_A, pass: MORNING }),
    ]);
    expect(shape(items)).toEqual(["b[b1,b2]", "a[a1,a2]"]);
  });

  it("counts statuses for the line", () => {
    const counts = passLogCounts([
      dose("a", "08:00"),
      dose("b", "08:00", { status: "refused" }),
      dose("c", "08:00"),
      dose("d", "08:00"),
    ]);
    expect(counts).toEqual({ given: 3, skipped: 0, refused: 1 });
    expect(passLogText("Morning", counts)).toBe("Morning: 3 given, 1 refused");
    expect(passLogText(null, { given: 0, skipped: 2, refused: 0 })).toBe("Medications: 2 skipped");
    expect(passLogText("Evening", { given: 1, skipped: 1, refused: 1 })).toBe(
      "Evening: 1 given, 1 skipped, 1 refused",
    );
  });
});

describe("wholeLogsPage (the paging rule)", () => {
  const logOf = (row: string) => (row.includes(":") ? row.split(":")[0]! : null);

  it("shows the page as it is when nothing is split", () => {
    expect(wholeLogsPage(["a", "b", "c", "d"], 3, logOf)).toEqual(["a", "b", "c"]);
    expect(wholeLogsPage(["a", "L:1", "L:2", "c"], 3, logOf)).toEqual(["a", "L:1", "L:2"]);
  });

  it("holds back a log that runs past the page, so it shows whole with the next one", () => {
    expect(wholeLogsPage(["a", "L:1", "L:2", "L:3"], 3, logOf)).toEqual(["a"]);
    // The next page has it all.
    expect(wholeLogsPage(["a", "L:1", "L:2", "L:3", "b", "c"], 5, logOf)).toEqual([
      "a",
      "L:1",
      "L:2",
      "L:3",
      "b",
    ]);
  });

  it("at the beginning of the timeline (no extra row) shows everything", () => {
    expect(wholeLogsPage(["a", "L:1", "L:2"], 3, logOf)).toEqual(["a", "L:1", "L:2"]);
    expect(wholeLogsPage(["L:1", "L:2"], 3, logOf)).toEqual(["L:1", "L:2"]);
  });

  it("shows a log bigger than the page rather than nothing", () => {
    expect(wholeLogsPage(["L:1", "L:2", "L:3"], 2, logOf)).toEqual(["L:1", "L:2"]);
  });
});
