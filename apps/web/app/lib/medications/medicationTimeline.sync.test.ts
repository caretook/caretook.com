import { describe, expect, it } from "vitest";
import {
  doseChoicesQuery,
  timelineMedicationsQuery,
  toDoseChoices,
  toEntryMedication,
} from "./medicationTimeline.sync";
import { entryWindow } from "../timeline/timeline.sync";

const one = (sql: string) => sql.replace(/\s+/g, " ").trim();

describe("timelineMedicationsQuery", () => {
  it("reads the medications named by the timeline's window, deleted ones too", () => {
    const filters = { kind: "dose" as const, author: null };
    const window = entryWindow("g1", filters, 30);
    const query = timelineMedicationsQuery("g1", filters, 30);
    expect(one(query.sql)).toContain(
      `m.id IN (SELECT json_extract(details, '$.medicationId') ${one(window.sql)})`,
    );
    expect(query.sql).not.toContain("m.deleted_at IS NULL");
    expect(query.params).toEqual(["g1", ...window.params]);
  });

  it("maps a row, with a deleted medication's time in ISO", () => {
    expect(
      toEntryMedication({
        id: "m1",
        name: "Lisinopril",
        strength: "10 mg",
        deleted_at: "2026-11-17T21:45:25.229000Z",
      }),
    ).toEqual({ id: "m1", name: "Lisinopril", strength: "10 mg", deletedAt: "2026-11-17T21:45:25.229Z" });
  });
});

describe("doseChoicesQuery", () => {
  it("offers current, live medications, the most recently given first", () => {
    const { sql, params } = doseChoicesQuery("g1");
    expect(one(sql)).toContain("m.deleted_at IS NULL AND m.status = 'current'");
    expect(one(sql)).toContain("json_extract(e.details, '$.status') = 'given'");
    expect(one(sql)).toContain("ORDER BY last_given IS NULL, last_given DESC, m.name COLLATE NOCASE");
    expect(params).toEqual(["g1"]);
  });

  it("maps rows to choices", () => {
    expect(
      toDoseChoices([
        { id: "m1", name: "Metformin", strength: "500 mg", dose: "1 tablet", last_given: null },
      ]),
    ).toEqual([{ id: "m1", name: "Metformin", strength: "500 mg", dose: "1 tablet" }]);
  });
});
