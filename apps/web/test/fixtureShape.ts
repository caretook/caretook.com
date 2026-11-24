import type { Fixture } from "./fixtures";

import * as server from "@caretook/data/schema";
import { getTableColumns, getTableName, is } from "drizzle-orm";
import { PgTable } from "drizzle-orm/pg-core";
import { drizzleSchema, LOCAL_ONLY_TABLES } from "~/lib/sync/schema";

// Device fixtures against the server's schemas (test-health-2 slice 3): a
// fixture is a row as PowerSync delivers it (JSON as text, booleans as 1/0,
// timestamps as PowerSync's text), so `fixtureProblems` first checks that wire
// shape, then converts the row the way the server reads an upload (a small
// test-only converter; the real one is packages/api's upload registry) and
// parses it with the server's Zod schema for its table. Test only.

/** Postgres's columns by name, for every server table (the client-safe schema). */
const SERVER_TABLES = new Map<string, PgTable>(
  Object.values(server).flatMap((value) => (is(value, PgTable) ? [[getTableName(value), value]] : [])),
);

/** The device's columns, by table: every column a synced row holds, null when unset. */
const DEVICE_COLUMNS = new Map<string, string[]>(
  Object.values(drizzleSchema).map((table) => [
    getTableName(table),
    Object.values(getTableColumns(table) as Record<string, { name: string }>).map((c) => c.name),
  ]),
);

/**
 * Which server schema a table's fixtures must pass, and how it reads them:
 * `row` is a whole row as the server selects it (null columns kept), `input`
 * what the server accepts for it (a PUT's create, or the table's own update;
 * unset columns left out). A strict schema gets only its own fields.
 */
type Issue = { path: PropertyKey[]; message: string };
/** A Zod schema, structurally (apps/web doesn't depend on zod itself). */
type Schema = {
  safeParse(value: unknown): { success: true } | { success: false; error: { issues: Issue[] } };
  shape?: Record<string, unknown>;
  // An object schema's `pick` (typed loosely: Zod's own signature wants literal fields).
  pick?: unknown;
};
type Shape = { schema: Schema; reads: "row" | "input" };

export const FIXTURE_SCHEMAS: Readonly<Record<string, Shape>> = {
  care_group: { schema: server.careGroupSelectZSchema, reads: "row" },
  care_group_member: { schema: server.careGroupMemberSelectZSchema, reads: "row" },
  care_recipient: { schema: server.careRecipientSelectZSchema, reads: "row" },
  user: { schema: server.userSelectZSchema, reads: "row" },
  timeline_entry: { schema: server.timelineEntryUpsertZSchema, reads: "input" },
  note_document: { schema: server.noteDocumentCreateZSchema, reads: "input" },
  note_update: { schema: server.noteUpdateCreateZSchema, reads: "input" },
  provider: { schema: server.providerUpsertZSchema, reads: "input" },
  timeline_entry_provider: { schema: server.entryProviderLinkZSchema, reads: "input" },
  medication: { schema: server.medicationUpsertZSchema, reads: "input" },
  care_recipient_details: { schema: server.careRecipientDetailsUpdateZSchema, reads: "input" },
  medication_pass: { schema: server.medicationPassUpsertZSchema, reads: "input" },
  recipient_allergy: { schema: server.recipientAllergyUpsertZSchema, reads: "input" },
  care_period: { schema: server.carePeriodUpsertZSchema, reads: "input" },
  todo: { schema: server.todoUpsertZSchema, reads: "input" },
  recipient_condition: { schema: server.recipientConditionUpsertZSchema, reads: "input" },
  medication_condition: { schema: server.medicationConditionLinkZSchema, reads: "input" },
  condition_manager: { schema: server.conditionManagerLinkZSchema, reads: "input" },
  appointment_series: { schema: server.appointmentSeriesUpsertZSchema, reads: "input" },
};

/** Synced tables with no server schema for their rows, each with why. */
export const NO_FIXTURE_SCHEMA: Readonly<Record<string, string>> = {
  member_contact_share: "written only by the member's own contact form, with no schema for the row",
  symptom_type:
    "server-written only (a group's defaults, the backfill, a symptom write) until devices upload it",
};

/** The device tables that sync (local-only ones never come from the server). */
export const SYNCED_TABLES = [...DEVICE_COLUMNS.keys()].filter((t) => !LOCAL_ONLY_TABLES.includes(t));

/** PowerSync's timestamptz text: `2026-11-17T21:45:25.229000Z` (`toLocalTimestamp`). */
const POWERSYNC_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/;

type ServerColumn = { name: string; columnType: string };

/** One device value → what the server reads, or a problem with its wire shape. */
const fromWire = (column: ServerColumn, value: unknown): { value: unknown } | { problem: string } => {
  if (value === null || value === undefined) return { value: null };
  const type = column.columnType;
  if (type === "PgJsonb" || type === "PgJson") {
    if (typeof value !== "string") return { problem: "JSON must be text" };
    try {
      return { value: JSON.parse(value) as unknown };
    } catch {
      return { problem: "is not JSON text" };
    }
  }
  if (type === "PgBoolean")
    return value === 1 || value === 0 ? { value: value === 1 } : { problem: "a boolean must be 1 or 0" };
  if (type.startsWith("PgTimestamp"))
    return typeof value === "string" && POWERSYNC_TIMESTAMP.test(value)
      ? { value }
      : { problem: "a timestamp must be PowerSync's text (2026-11-17T21:45:25.229000Z)" };
  if (type.startsWith("PgInteger") || type.startsWith("PgSmallInt") || type.startsWith("PgBigInt"))
    return typeof value === "number" && Number.isInteger(value)
      ? { value }
      : { problem: "an integer must be a number" };
  return typeof value === "string" ? { value } : { problem: "must be text" };
};

/** An object schema's own fields (a refined object keeps its shape), else null: it takes any. */
const ownFields = (schema: Schema): string[] | null => (schema.shape ? Object.keys(schema.shape) : null);

/**
 * What's wrong with a fixture as a synced row: its wire shape, then the
 * server schema's issues (`path: message`). Empty when it passes; throws for a
 * table with no schema (`NO_FIXTURE_SCHEMA`).
 */
export const fixtureProblems = (fixture: Fixture): string[] => {
  const shape = FIXTURE_SCHEMAS[fixture.table];
  if (!shape) throw new Error(`fixtureShape: no server schema for ${fixture.table}`);
  const table = SERVER_TABLES.get(fixture.table);
  const deviceColumns = DEVICE_COLUMNS.get(fixture.table);
  if (!table || !deviceColumns) throw new Error(`fixtureShape: ${fixture.table} isn't a synced table`);
  const serverColumns = new Map(
    Object.entries(getTableColumns(table) as Record<string, ServerColumn>).map(([field, c]) => [
      c.name,
      { field, column: c },
    ]),
  );

  const problems: string[] = [];
  const converted: Record<string, unknown> = {};
  for (const name of deviceColumns) {
    const server = serverColumns.get(name);
    if (!server) {
      problems.push(`${name}: no such server column`);
      continue;
    }
    const out = fromWire(server.column, fixture.row[name]);
    if ("problem" in out) problems.push(`${name}: ${out.problem}`);
    else if (out.value !== null || shape.reads === "row") converted[server.field] = out.value;
  }
  if (problems.length > 0) return problems;

  // A row schema covers the whole server row: only the columns devices get
  // are checked (all present, null kept). A strict input gets only its fields.
  const fields = ownFields(shape.schema);
  const schema =
    shape.reads === "row" && typeof shape.schema.pick === "function"
      ? (shape.schema.pick as (fields: Record<string, true>) => Schema).call(
          shape.schema,
          Object.fromEntries(Object.keys(converted).map((f) => [f, true as const])),
        )
      : shape.schema;
  const input = fields
    ? Object.fromEntries(Object.entries(converted).filter(([field]) => fields.includes(field)))
    : converted;
  const parsed = schema.safeParse(input);
  return parsed.success
    ? []
    : parsed.error.issues.map((issue) => `${issue.path.map(String).join(".") || "(row)"}: ${issue.message}`);
};
