import type { UploadColumns } from "./syncRegistry";

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { powerSyncSchema } from "../../../apps/web/app/lib/sync/schema";
import { schemaTables } from "../../data/src/db/roles/schemaTables";
import { syncedColumns } from "../../data/src/db/roles/syncConfig";
import { UPLOAD_REGISTRY } from "./syncRegistry";

// The three column lists agree (sync-safety slice 1, B-292): every column
// of a synced device table is in its stream in powersync/sync-config.yaml,
// and every column of an uploadable one is in the upload registry's lists.
// A column in only one place is either dropped on the device, always null
// there, or silently ignored (or refused) when the device uploads it.
// No database: the device schema, the sync config and the registry are read
// as they are. Prior art: scripts/project/sync-matrix.test.mjs, rolesSql.test.ts.

/** Device columns that no stream carries, on purpose. None so far. */
const DEVICE_ONLY_COLUMNS: Readonly<Record<string, readonly string[]>> = {};

const WHERE =
  "Each device column must be in apps/web/app/lib/sync/schema.ts (the device schema), " +
  "powersync/sync-config.yaml (its stream; or DEVICE_ONLY_COLUMNS in syncRegistry.test.ts), and, " +
  "for an uploadable table, packages/api/src/syncRegistry.ts (its content, fixed, handled or serverSet list).";

type DeviceTable = { table: string; columns: string[]; localOnly: boolean };

/** A Drizzle column, as the device schema's tables carry them (no drizzle import here). */
const isColumn = (value: unknown): value is { name: string } =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as { name?: unknown }).name === "string" &&
  typeof (value as { columnType?: unknown }).columnType === "string";

/** A device table's SQL name (Drizzle keeps it under this symbol). */
const tableName = (table: object) =>
  (table as Record<symbol, unknown>)[Symbol.for("drizzle:Name")] as string | undefined;

/**
 * The device schema's tables, as PowerSync gets them: a Drizzle table, or
 * `{ tableDefinition, options }`. A table marked local-only (`localOnly`) is
 * never synced or uploaded, so the agreement skips it.
 */
const deviceTables = (schema: Record<string, unknown>): DeviceTable[] =>
  Object.values(schema).map((entry) => {
    const wrapped = (entry as { tableDefinition?: object }).tableDefinition;
    const table = (wrapped ?? entry) as object;
    const options = wrapped ? (entry as { options?: { localOnly?: boolean } }).options : undefined;
    return {
      table: tableName(table) ?? "?",
      columns: Object.values(table)
        .filter(isColumn)
        .map((c) => c.name),
      localOnly: options?.localOnly === true,
    };
  });

const columnsIn = (lists: UploadColumns) => new Set(Object.values(lists).flat());

/** Every disagreement, one line each; empty when the lists agree. */
const disagreements = (
  device: DeviceTable[],
  synced: ReadonlyMap<string, readonly string[]>,
  uploads: ReadonlyMap<string, { columns: UploadColumns }>,
  deviceOnly: Readonly<Record<string, readonly string[]>>,
) =>
  device
    .filter((t) => !t.localOnly)
    .flatMap(({ table, columns }) => {
      const stream = new Set([...(synced.get(table) ?? []), ...(deviceOnly[table] ?? [])]);
      const upload = uploads.get(table);
      const known = upload ? columnsIn(upload.columns) : undefined;
      return columns.flatMap((column) => [
        ...(stream.has(column) ? [] : [`${table}.${column} is in the device schema but in no stream`]),
        ...(known && !known.has(column)
          ? [`${table}.${column} is uploadable but in none of the registry's lists`]
          : []),
      ]);
    });

const SYNC_CONFIG = readFileSync(new URL("../../../powersync/sync-config.yaml", import.meta.url), "utf8");
const SYNCED = new Map(syncedColumns(SYNC_CONFIG, schemaTables()).map((t) => [t.table, t.columns]));
const DEVICE = deviceTables(powerSyncSchema);

describe("the device schema, the sync config and the upload registry", () => {
  it("reads all three", () => {
    expect(DEVICE.map((t) => t.table)).toContain("timeline_entry");
    expect(DEVICE.find((t) => t.table === "todo")?.columns).toContain("done_at");
    expect(SYNCED.get("todo")).toContain("done_at");
    expect(UPLOAD_REGISTRY.get("todo")?.columns.content).toContain("title");
  });

  it("agree on every column", () => {
    expect(disagreements(DEVICE, SYNCED, UPLOAD_REGISTRY, DEVICE_ONLY_COLUMNS), WHERE).toEqual([]);
  });

  it("uploads only device tables", () => {
    const tables = new Set(DEVICE.map((t) => t.table));
    expect([...UPLOAD_REGISTRY.keys()].filter((t) => !tables.has(t))).toEqual([]);
  });

  it("fails on a column missing from the stream or from the registry", () => {
    const withoutBody = new Map(SYNCED).set(
      "timeline_entry",
      (SYNCED.get("timeline_entry") ?? []).filter((c) => c !== "body"),
    );
    expect(disagreements(DEVICE, withoutBody, UPLOAD_REGISTRY, DEVICE_ONLY_COLUMNS)).toEqual([
      "timeline_entry.body is in the device schema but in no stream",
    ]);

    const todo = UPLOAD_REGISTRY.get("todo");
    if (!todo) throw new Error("no todo in the registry");
    const withoutTitle = new Map(UPLOAD_REGISTRY).set("todo", {
      ...todo,
      columns: { ...todo.columns, content: todo.columns.content.filter((c) => c !== "title") },
    });
    expect(disagreements(DEVICE, SYNCED, withoutTitle, DEVICE_ONLY_COLUMNS)).toEqual([
      "todo.title is uploadable but in none of the registry's lists",
    ]);
  });

  it("skips a device table marked local-only, and nothing else", () => {
    const local = { table: "unsaved_change", columns: ["id", "op_data", "code"] };
    expect(disagreements([...DEVICE, { ...local, localOnly: true }], SYNCED, UPLOAD_REGISTRY, {})).toEqual(
      [],
    );
    expect(disagreements([...DEVICE, { ...local, localOnly: false }], SYNCED, UPLOAD_REGISTRY, {})).toEqual([
      "unsaved_change.id is in the device schema but in no stream",
      "unsaved_change.op_data is in the device schema but in no stream",
      "unsaved_change.code is in the device schema but in no stream",
    ]);
    expect(
      deviceTables({
        t: { tableDefinition: powerSyncSchema.todos.tableDefinition, options: { localOnly: true } },
      }),
    ).toMatchObject([{ table: "todo", localOnly: true }]);
  });
});
