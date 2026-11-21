// roundtrip.mjs's sync matrix (scripts/browser-checks/sync-matrix.mjs) against
// the device schema and the upload switch: a new synced table must add a row.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  ENTRY_PROVIDER_NAMESPACE,
  MEDICATION_CONDITION_NAMESPACE,
  SYNC_MATRIX,
  entryProviderId,
  medicationConditionId,
} from "../browser-checks/sync-matrix.mjs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

/** The tables in a device schema's source: every `sqliteTable("name", …)`. */
const deviceTables = (source) => [...source.matchAll(/sqliteTable\(\s*"([a-z_]+)"/g)].map((m) => m[1]);

/** The tables the upload switch accepts: the keys of `const HANDLERS = { … }`. */
const uploadTables = (source) => {
  const block = /const HANDLERS\b.*= \{\n([\s\S]*?)\n\};/.exec(source)?.[1] ?? "";
  return [...block.matchAll(/^\s*([a-z_]+):/gm)].map((m) => m[1]);
};

const matrixTables = (matrix) => matrix.map((r) => r.table);
const missingFrom = (matrix, tables) => tables.filter((t) => !matrixTables(matrix).includes(t));

describe("the sync matrix", () => {
  const schema = deviceTables(read("../../apps/web/app/lib/sync/schema.ts"));
  const uploads = uploadTables(read("../../packages/api/src/sync.ts"));

  it("finds the device schema's tables and the upload switch's", () => {
    expect(schema).toContain("timeline_entry");
    expect(schema.length).toBeGreaterThan(10);
    expect(uploads).toContain("timeline_entry");
  });

  it("has one row for every table in the device schema, and nothing else", () => {
    expect(missingFrom(SYNC_MATRIX, schema)).toEqual([]);
    expect([...matrixTables(SYNC_MATRIX)].sort()).toEqual([...schema].sort());
  });

  it("writes every uploadable table from the device, and no other", () => {
    const fromDevice = SYNC_MATRIX.filter((r) => r.by !== "server").map((r) => r.table);
    expect([...fromDevice].sort()).toEqual([...uploads].sort());
  });

  it("fails when a device-schema table has no row", () => {
    const withNewTable = `${read("../../apps/web/app/lib/sync/schema.ts")}\nexport const reminders = sqliteTable("reminder", {});`;
    expect(missingFrom(SYNC_MATRIX, deviceTables(withNewTable))).toEqual(["reminder"]);
  });

  it("derives a link's id as packages/data does", async () => {
    const data = await import("../../packages/data/src/db/schema/providers/entryProvider.ts");
    expect(ENTRY_PROVIDER_NAMESPACE).toBe(data.ENTRY_PROVIDER_NAMESPACE);
    const [entry, provider] = [
      "0B6F3C1E-5D1A-4C2E-9A77-3F1D2B8C0001",
      "2f4e1d7a-0c3b-4a5e-9d8f-1a2b3c4d5e6f",
    ];
    expect(entryProviderId(entry, provider)).toBe(data.entryProviderId(entry, provider));
  });

  it("derives a medication's condition link id as packages/data does", async () => {
    const data = await import("../../packages/data/src/db/schema/profiles/medicationCondition.ts");
    expect(MEDICATION_CONDITION_NAMESPACE).toBe(data.MEDICATION_CONDITION_NAMESPACE);
    const [medication, condition] = [
      "0B6F3C1E-5D1A-4C2E-9A77-3F1D2B8C0002",
      "2f4e1d7a-0c3b-4a5e-9d8f-1a2b3c4d5e70",
    ];
    expect(medicationConditionId(medication, condition)).toBe(
      data.medicationConditionId(medication, condition),
    );
  });
});
