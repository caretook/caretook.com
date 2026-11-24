// roundtrip.mjs's sync matrix (scripts/browser-checks/sync-matrix.mjs) against
// the device schema and the upload switch: a new synced table must add a row.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  CONDITION_MANAGER_NAMESPACE,
  ENTRY_PROVIDER_NAMESPACE,
  MEDICATION_CONDITION_NAMESPACE,
  SERVER_SET_COLUMNS,
  SYNC_MATRIX,
  columnMismatches,
  conditionManagerId,
  entryProviderId,
  exceptionProblems,
  medicationConditionId,
  streamColumns,
  writtenRow,
} from "../browser-checks/sync-matrix.mjs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

/** The tables in a device schema's source: every `sqliteTable("name", …)`. */
const allDeviceTables = (source) => [...source.matchAll(/sqliteTable\(\s*"([a-z_]+)"/g)].map((m) => m[1]);

/**
 * The synced ones: local-only tables (`LOCAL_ONLY_TABLES`, PowerSync's
 * `localOnly`, such as `unsaved_change`) never sync or upload, so they have
 * no matrix row.
 */
const { LOCAL_ONLY_TABLES } = await import("../../apps/web/app/lib/sync/schema.ts");
const deviceTables = (source) => allDeviceTables(source).filter((t) => !LOCAL_ONLY_TABLES.includes(t));

/** The tables the upload registry accepts: the keys of `UPLOAD_REGISTRY = new Map([ … ])`. */
const uploadTables = (source) => {
  const block = /UPLOAD_REGISTRY\b.*= new Map\(\[\n([\s\S]*?)\n\]\);/.exec(source)?.[1] ?? "";
  return [...block.matchAll(/^\s*\["([a-z_]+)",/gm)].map((m) => m[1]);
};

const matrixTables = (matrix) => matrix.map((r) => r.table);
const missingFrom = (matrix, tables) => tables.filter((t) => !matrixTables(matrix).includes(t));

describe("the sync matrix", () => {
  const schema = deviceTables(read("../../apps/web/app/lib/sync/schema.ts"));
  const uploads = uploadTables(read("../../packages/api/src/syncRegistry.ts"));

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

  it("skips the device's local-only tables, and only those", () => {
    expect(LOCAL_ONLY_TABLES).toEqual(["unsaved_change"]);
    const all = allDeviceTables(read("../../apps/web/app/lib/sync/schema.ts"));
    expect(all.filter((t) => !schema.includes(t))).toEqual(LOCAL_ONLY_TABLES);
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

  it("derives a condition's manager link id as packages/data does", async () => {
    const data = await import("../../packages/data/src/db/schema/profiles/conditionManager.ts");
    expect(CONDITION_MANAGER_NAMESPACE).toBe(data.CONDITION_MANAGER_NAMESPACE);
    const [condition, provider] = [
      "0B6F3C1E-5D1A-4C2E-9A77-3F1D2BF01001",
      "2f4e1d7a-0c3b-4a5e-9d8f-1a2b3c4d5e71",
    ];
    expect(conditionManagerId(condition, provider)).toBe(data.conditionManagerId(condition, provider));
  });
});

describe("the matrix's column comparison", () => {
  const config = read("../../powersync/sync-config.yaml");
  const streams = streamColumns(config);
  const deviceWritten = SYNC_MATRIX.filter((r) => r.by === "device").map((r) => r.table);

  it("reads each table's streamed columns as packages/data's sync config reader does", async () => {
    const { syncedColumns } = await import("../../packages/data/src/db/roles/syncConfig.ts");
    const { schemaTables } = await import("../../packages/data/src/db/roles/schemaTables.ts");
    const full = syncedColumns(config, schemaTables());
    expect([...streams.keys()].sort()).toEqual(full.map((t) => t.table).sort());
    for (const { table, columns } of full)
      expect([...(streams.get(table) ?? [])].sort()).toEqual([...columns].sort());
  });

  it("streams every matrix table", () => {
    expect(SYNC_MATRIX.map((r) => r.table).filter((t) => !streams.has(t))).toEqual([]);
  });

  it("names only columns the streams send in its server-set exceptions", () => {
    expect(exceptionProblems(SERVER_SET_COLUMNS, streams, deviceWritten)).toEqual([]);
    expect(Object.keys(SERVER_SET_COLUMNS).filter((t) => t !== "*" && !deviceWritten.includes(t))).toEqual(
      [],
    );
  });

  it("fails an exception naming a column the stream doesn't send, or a table no stream sends", () => {
    const bad = {
      ...SERVER_SET_COLUMNS,
      provider: { nickname: "made up" },
      "*": { ...SERVER_SET_COLUMNS["*"], synced_at: "made up" },
      reminder: { id: "made up" },
    };
    const problems = exceptionProblems(bad, streams, deviceWritten);
    expect(problems).toContain("provider.nickname: its stream doesn't send this column");
    expect(problems).toContain("reminder: no stream sends this table");
    expect(
      problems.filter((p) => p.endsWith(".synced_at: its stream doesn't send this column")),
    ).toHaveLength(deviceWritten.length);
  });

  it("reads the row an INSERT writes", () => {
    const [row] = SYNC_MATRIX.filter((r) => r.table === "provider");
    const ctx = { tag: "T", groupId: "g", recipientId: "r", userId: "u", now: "n", ids: { provider: "p" } };
    expect(writtenRow(row.write(ctx))).toMatchObject({
      id: "p",
      group_id: "g",
      name: "T matrix provider",
      phones: "[]",
    });
  });

  it("fails a dropped or changed column, and passes JSON Postgres reformatted", () => {
    const columns = ["id", "name", "phones", "schedule", "created_at"];
    const written = {
      id: "1",
      name: "Ann",
      phones: "[]",
      schedule: '{"type":"asNeeded","at":1}',
      created_at: "t0",
    };
    const skip = { created_at: "server-set" };
    const same = { ...written, schedule: '{"at": 1, "type": "asNeeded"}', created_at: "t1" };
    expect(columnMismatches(written, same, columns, skip)).toEqual([]);
    expect(columnMismatches(written, { ...same, name: null }, columns, skip)).toEqual(['name: "Ann" → null']);
    expect(columnMismatches(written, { ...same, phones: '["1"]' }, columns, skip)).toEqual([
      'phones: "[]" → "[\\"1\\"]"',
    ]);
    expect(columnMismatches(written, same, columns)).toEqual(['created_at: "t0" → "t1"']);
    expect(columnMismatches(written, { ...same, via: "mcp" }, [...columns, "via"], skip)).toEqual([
      'via: null → "mcp"',
    ]);
  });
});
