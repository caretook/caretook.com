import type { TimelineEntryDetails, TimelineEntryKind } from "@caretook/data/schema";
import type { TimelineItem } from "../../../../lib/timeline/timelineDays";

import { describe, expect, it } from "vitest";
import { foldPassLogs } from "./dayItems";

const MORNING = "11111111-1111-4111-8111-111111111111";
const LOG = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

type E = { id: string; kind: TimelineEntryKind; details: TimelineEntryDetails | null; occurredAt: string };
type M = { id: string };

const at = (time: string) => `2026-11-17T${time}:00.000Z`;
const dose = (id: string, time: string, log?: string): TimelineItem<E, M> => {
  const entry: E = {
    id,
    kind: "dose",
    occurredAt: at(time),
    details: {
      medicationId: "00000000-0000-4000-8000-000000000001",
      status: "given",
      ...(log && { passLogId: log, passId: MORNING }),
    },
  };
  return { type: "entry", key: id, occurredAt: entry.occurredAt, entry };
};
const note = (id: string, time: string): TimelineItem<E, M> => {
  const entry: E = { id, kind: "note", occurredAt: at(time), details: null };
  return { type: "entry", key: id, occurredAt: entry.occurredAt, entry };
};
const marker = (id: string, time: string): TimelineItem<E, M> => ({
  type: "marker",
  key: `marker-${id}`,
  occurredAt: at(time),
  marker: { id },
});

const shape = (items: ReturnType<typeof foldPassLogs<E, M>>) =>
  items.map((it) =>
    it.type === "entry" ? it.entry.id : it.type === "passLog" ? `log:${it.entries.length}` : it.key,
  );

describe("foldPassLogs", () => {
  it("folds a pass log when the day has no markers", () => {
    expect(
      shape(foldPassLogs([note("n", "10:00"), dose("a", "08:01", LOG), dose("b", "08:00", LOG)])),
    ).toEqual(["n", "log:2"]);
  });

  it("keeps markers at their moments around a folded log", () => {
    const items = [
      note("n", "12:00"),
      marker("p", "09:00"),
      dose("a", "08:01", LOG),
      dose("b", "08:00", LOG),
      note("m", "07:00"),
    ];
    expect(shape(foldPassLogs(items))).toEqual(["n", "marker-p", "log:2", "m"]);
  });

  it("puts a log at a marker's exact moment above the marker", () => {
    const items = [dose("a", "09:00", LOG), marker("p", "09:00"), note("m", "07:00")];
    expect(shape(foldPassLogs(items))).toEqual(["log:1", "marker-p", "m"]);
    const two = [dose("a", "09:05", LOG), dose("b", "09:00", LOG), marker("p", "09:00")];
    expect(shape(foldPassLogs(two))).toEqual(["log:2", "marker-p"]);
  });

  it("keeps a day of only markers", () => {
    expect(shape(foldPassLogs([marker("p", "09:00")]))).toEqual(["marker-p"]);
  });
});
