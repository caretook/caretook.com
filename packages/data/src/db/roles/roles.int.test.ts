import { randomBytes, randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { getDb } from "../client";
import { applyRoles, ident, literal, REPLICATION_WHOLE_TABLES, type RoleNames } from ".";

// The generated roles on the test database (hosting slice 2): applied twice,
// then used by connecting as each role. Roles are cluster-wide and the shared
// test Postgres serves every worktree, so the names are unique to this run and
// dropped afterwards; the publication too, so the migrations' `powersync`
// publication is left alone.

const run = randomBytes(4).toString("hex");
const names: RoleNames = {
  migrations: `ct${run}_migrations`,
  app: `ct${run}_app`,
  replication: `ct${run}_replication`,
  publication: `ct${run}_pub`,
};
const password = randomBytes(18).toString("base64url");
const clients: pg.Client[] = [];

const connectAs = async (role: string) => {
  const url = new URL(process.env.DATABASE_URL ?? "");
  url.username = role;
  url.password = password;
  const client = new pg.Client({ connectionString: url.toString(), connectionTimeoutMillis: 5000 });
  // A revoke ends the role's sessions: that's an event, not a test failure.
  client.on("error", () => undefined);
  await client.connect();
  clients.push(client);
  return client;
};

/** The Postgres error code a query fails with, or null when it succeeds. */
const failsWith = async (client: pg.Client, query: string) => {
  try {
    await client.query(query);
    return null;
  } catch (e) {
    return (e as { code?: string }).code ?? "unknown";
  }
};

const INSUFFICIENT_PRIVILEGE = "42501";
const MUST_BE_OWNER = "42501";

let generated: Awaited<ReturnType<typeof applyRoles>>;

beforeAll(async () => {
  generated = await applyRoles({ names });
});

afterAll(async () => {
  await Promise.all(clients.map((c) => c.end().catch(() => undefined)));
  const db = getDb();
  await db.execute(sql.raw(`DROP PUBLICATION IF EXISTS ${ident(names.publication)}`));
  for (const role of [names.app, names.replication, names.migrations]) {
    await db.execute(sql.raw(`DROP OWNED BY ${ident(role)} CASCADE`)).catch(() => undefined);
    await db.execute(sql.raw(`DROP ROLE IF EXISTS ${ident(role)}`));
  }
});

describe("applyRoles", () => {
  it("applies twice without error and ends with the same grants", async () => {
    if ("code" in generated) throw new Error(String(generated.code), { cause: generated });
    const again = await applyRoles({ names });
    if ("code" in again) throw new Error(String(again.code), { cause: again });
    expect(again.summary).toEqual(generated.summary);

    // The test connects as each role with a password the runbook would set.
    for (const role of [names.migrations, names.app, names.replication])
      await getDb().execute(sql.raw(`ALTER ROLE ${ident(role)} PASSWORD ${literal(password)}`));
  });

  it("lets the app role read and write every table, and nothing more", async () => {
    const app = await connectAs(names.app);
    const id = randomUUID();
    await app.query(
      `INSERT INTO "user" (id, email, name, created_by, updated_by) VALUES ($1, $2, 'Role Test', $1, $1)`,
      [id, `roles-${run}@example.com`],
    );
    const read = await app.query(`SELECT name FROM "user" WHERE id = $1`, [id]);
    expect(read.rows).toEqual([{ name: "Role Test" }]);
    await app.query(`DELETE FROM "user" WHERE id = $1`, [id]);

    expect(await failsWith(app, `CREATE TABLE ct${run}_nope (id int)`)).toBe(INSUFFICIENT_PRIVILEGE);
    expect(await failsWith(app, `ALTER TABLE "user" ADD COLUMN nope int`)).toBe(MUST_BE_OWNER);
    expect(await failsWith(app, `DROP TABLE "account"`)).toBe(MUST_BE_OWNER);
  });

  it("gives the app role tables the migrations role creates later", async () => {
    const table = `ct${run}_later`;
    const migrations = await connectAs(names.migrations);
    await migrations.query(`CREATE TABLE ${table} (id int PRIMARY KEY, secret text)`);
    try {
      const app = await connectAs(names.app);
      await app.query(`INSERT INTO ${table} VALUES (1, 'x')`);
      expect((await app.query(`SELECT id FROM ${table}`)).rows).toEqual([{ id: 1 }]);
      const replication = await connectAs(names.replication);
      expect(await failsWith(replication, `SELECT id FROM ${table}`)).toBe(INSUFFICIENT_PRIVILEGE);
    } finally {
      await migrations.query(`DROP TABLE ${table}`);
    }
  });

  it("lets the replication role read only the synced tables, and only their columns", async () => {
    if ("code" in generated) throw new Error("not applied");
    const replication = await connectAs(names.replication);
    expect(await failsWith(replication, `SELECT id, name, image FROM "user"`)).toBeNull();
    expect(await failsWith(replication, `SELECT id, group_id, title FROM timeline_entry`)).toBeNull();
    // Conditions (conditions slice 1): the table and the recipient's flag.
    expect(
      await failsWith(
        replication,
        `SELECT id, group_id, name, status, since_year, since_month, note, diagnosed_by_id, deleted_at FROM recipient_condition`,
      ),
    ).toBeNull();
    expect(await failsWith(replication, `SELECT no_known_conditions_at FROM care_recipient`)).toBeNull();
    // What a medication is for (conditions slice 4).
    expect(
      await failsWith(
        replication,
        `SELECT id, group_id, medication_id, condition_id FROM medication_condition`,
      ),
    ).toBeNull();
    // Who manages a condition (conditions slice 3).
    expect(
      await failsWith(replication, `SELECT id, group_id, condition_id, provider_id FROM condition_manager`),
    ).toBeNull();
    // Which todos an entry links (planner-3 slice 1).
    expect(
      await failsWith(
        replication,
        `SELECT id, group_id, entry_id, todo_id, created_by FROM timeline_entry_todo`,
      ),
    ).toBeNull();
    // Tags and which records carry them (tags slice 1).
    expect(
      await failsWith(replication, `SELECT id, group_id, name, name_key, created_by FROM tag`),
    ).toBeNull();
    expect(
      await failsWith(
        replication,
        `SELECT id, group_id, tag_id, entry_id, todo_id, provider_id, medication_id, created_by FROM record_tag`,
      ),
    ).toBeNull();
    // The symptom catalog (symptom-catalog slice 1).
    expect(
      await failsWith(replication, `SELECT id, group_id, name, name_key, created_by FROM symptom_type`),
    ).toBeNull();
    expect(await failsWith(replication, `SELECT password FROM account`)).toBe(INSUFFICIENT_PRIVILEGE);
    expect(await failsWith(replication, `SELECT id FROM session`)).toBe(INSUFFICIENT_PRIVILEGE);
    expect(await failsWith(replication, `SELECT id FROM admin_audit_log`)).toBe(INSUFFICIENT_PRIVILEGE);
    expect(
      await failsWith(replication, `INSERT INTO "user" (id, email) VALUES (gen_random_uuid(), 'x')`),
    ).toBe(INSUFFICIENT_PRIVILEGE);

    const role = await getDb().execute(
      sql`SELECT rolreplication FROM pg_roles WHERE rolname = ${names.replication}`,
    );
    expect(role.rows).toEqual([{ rolreplication: true }]);
    // Column grants for every synced table but REPLICATION_WHOLE_TABLES, which get a table grant.
    const replicationRole = generated.summary.roles.find((r) => r.role === names.replication);
    expect(replicationRole?.columns).toEqual(
      Object.fromEntries(
        generated.generated.replication
          .filter((g) => !REPLICATION_WHOLE_TABLES.includes(g.table))
          .map((g) => [g.table, [...g.columns].sort()]),
      ),
    );
    expect(replicationRole?.tablePrivileges).toEqual({ SELECT: REPLICATION_WHOLE_TABLES.length });
  });

  // PowerSync's first snapshot of each published table is `SELECT * FROM <table>`
  // (1.28.3, module-postgres SnapshotQuery). A synced table whose stream leaves a
  // column out, and that isn't in REPLICATION_WHOLE_TABLES, fails here, not on
  // the first deploy.
  it("lets the replication role run PowerSync's snapshot query on every synced table", async () => {
    if ("code" in generated) throw new Error("not applied");
    const replication = await connectAs(names.replication);
    const refused: string[] = [];
    for (const { table } of generated.generated.replication) {
      const code = await failsWith(replication, `SELECT * FROM ${ident(table)} LIMIT 1`);
      if (code) refused.push(`${table} (${code})`);
    }
    expect(refused).toEqual([]);
  });

  it("publishes the same tables with the same column lists", () => {
    if ("code" in generated) throw new Error("not applied");
    const sorted = (lists: Record<string, string[]>) =>
      Object.fromEntries(Object.entries(lists).map(([t, cols]) => [t, [...cols].sort()]));
    const expected = Object.fromEntries(generated.generated.replication.map((g) => [g.table, g.columns]));
    expect(sorted(generated.summary.publication)).toEqual(sorted(expected));
    expect([...(generated.summary.publication.user ?? [])].sort()).toEqual([
      "avatar_color",
      "avatar_icon",
      "id",
      "image",
      "name",
    ]);
    expect(generated.summary.publication).not.toHaveProperty("account");
    // "user" is granted whole for the snapshot, but its changes replicate only these.
    expect(generated.summary.publication.user).not.toContain("email");
  });
});
