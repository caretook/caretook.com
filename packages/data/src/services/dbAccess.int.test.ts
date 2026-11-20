import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import pg from "pg";
import { afterAll, describe, expect, it } from "vitest";
import { createUser, ok } from "../../test/fixtures";
import { getDb } from "../db";
import { ident, personalAccessSql, randomPassword, schemaTables } from "../db/roles";
import { adminAuditLogSchema } from "../db/schema";
import { isError } from "../errors";
import { dbAccessService } from ".";

// `pnpm db:access` (hosting slice 2): a staff member's personal role reads but
// can't write, expires, is dropped by revoke, and each step is audited. The
// fixture emails are unique, so the role names are too; every role made here
// is dropped afterwards (roles are shared by every worktree's test database).

const made = new Set<string>();
const clients: pg.Client[] = [];

afterAll(async () => {
  await Promise.all(clients.map((c) => c.end().catch(() => undefined)));
  for (const role of made) {
    await getDb()
      .execute(sql.raw(`DROP OWNED BY ${ident(role)}`))
      .catch(() => undefined);
    await getDb().execute(sql.raw(`DROP ROLE IF EXISTS ${ident(role)}`));
  }
});

const entriesFor = (userId: string) =>
  getDb().select().from(adminAuditLogSchema).where(eq(adminAuditLogSchema.targetUserId, userId));

const connectAs = async (role: string, password: string) => {
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

const roleRow = async (role: string) =>
  (
    await getDb().execute(
      sql`SELECT rolname, rolvaliduntil, rolcanlogin FROM pg_roles WHERE rolname = ${role}`,
    )
  ).rows[0] as { rolname: string; rolvaliduntil: Date | null; rolcanlogin: boolean } | undefined;

/** Every grant `role` holds, table-level and column-level, from both views. */
const grantsOf = async (role: string) => {
  const tables = await getDb().execute(
    sql`SELECT table_name, privilege_type FROM information_schema.role_table_grants WHERE grantee = ${role}`,
  );
  const columns = await getDb().execute(
    sql`SELECT table_name, column_name FROM information_schema.column_privileges WHERE grantee = ${role}`,
  );
  return { tables: tables.rows, columns: columns.rows };
};

class Rollback extends Error {}

const refusal = (client: pg.Client, query: string) =>
  client.query(query).then(
    () => "allowed",
    (e: { code?: string }) => e.code,
  );

describe("dbAccessService", () => {
  it("grants a read-only role that expires, and records it", async () => {
    const { user } = await createUser("db-access", "support");
    const password = randomPassword();
    const now = new Date();
    const res = ok(await dbAccessService.grant({ email: user.email, hours: 2, password, now }));
    made.add(res.role);
    expect(res.role).toMatch(/^staff_db_access_[a-z0-9]+_example_com$/);

    const row = await roleRow(res.role);
    expect(row?.rolcanlogin).toBe(true);
    expect(row?.rolvaliduntil && new Date(row.rolvaliduntil).getTime()).toBe(now.getTime() + 2 * 3_600_000);

    const staff = await connectAs(res.role, password);
    const read = await staff.query(`SELECT email FROM "user" WHERE id = $1`, [user.id]);
    expect(read.rows).toEqual([{ email: user.email }]);
    const write = await staff.query(`UPDATE "user" SET name = 'x' WHERE id = $1`, [user.id]).then(
      () => null,
      (e: { code?: string }) => e.code,
    );
    expect(["42501", "25006"]).toContain(write); // no privilege, or a read-only transaction
    await expect(staff.query(`DELETE FROM admin_audit_log`)).rejects.toThrow();
    await expect(staff.query(`CREATE TABLE staff_nope (id int)`)).rejects.toThrow();

    const listed = ok(await dbAccessService.list(now));
    expect(listed.find((r) => r.role === res.role)).toMatchObject({ userId: user.id, expired: false });
    const later = ok(await dbAccessService.list(new Date(now.getTime() + 3 * 3_600_000)));
    expect(later.find((r) => r.role === res.role)?.expired).toBe(true);

    const [entry, ...rest] = await entriesFor(user.id);
    expect(rest).toHaveLength(0);
    expect(entry).toMatchObject({
      actorId: null,
      action: "db.accessGranted",
      changes: { role: [null, res.role], hours: [null, 2], validUntil: [null, res.validUntil] },
    });
    expect(entry?.reason).toBeTruthy();
    // The password is never in the log.
    expect(JSON.stringify(entry)).not.toContain(password);
  });

  it("refuses a role that has passed its expiry at sign-in", async () => {
    const { user } = await createUser("db-expired", "admin");
    const password = randomPassword();
    const past = new Date(Date.now() - 3 * 3_600_000);
    const res = ok(await dbAccessService.grant({ email: user.email, hours: 1, password, now: past }));
    made.add(res.role);
    await expect(connectAs(res.role, password)).rejects.toThrow(/password authentication failed/);
  });

  it("revokes by dropping the role, records it, and is safe to run twice", async () => {
    const { user } = await createUser("db-revoke", "support");
    const password = randomPassword();
    const res = ok(await dbAccessService.grant({ email: user.email, hours: 1, password }));
    made.add(res.role);
    const open = await connectAs(res.role, password);

    const revoked = ok(await dbAccessService.revoke({ email: user.email }));
    expect(revoked).toMatchObject({ role: res.role, dropped: true });
    expect(await roleRow(res.role)).toBeUndefined();
    // Its open session was ended.
    await expect(open.query("SELECT 1")).rejects.toThrow();

    const again = ok(await dbAccessService.revoke({ email: user.email }));
    expect(again).toMatchObject({ dropped: false });
    const actions = (await entriesFor(user.id)).map((e) => e.action).sort();
    expect(actions).toEqual(["db.accessGranted", "db.accessRevoked"]);
  });

  it("reads care tables but never the secrets, and revoke leaves no grants", async () => {
    const { user } = await createUser("db-narrow", "support");
    const password = randomPassword();
    const res = ok(await dbAccessService.grant({ email: user.email, hours: 1, password }));
    made.add(res.role);
    const staff = await connectAs(res.role, password);

    expect((await staff.query("SELECT count(*) FROM care_group")).rows).toHaveLength(1);
    expect(
      (await staff.query("SELECT id, status FROM care_group_invite LIMIT 1")).rowCount,
    ).toBeGreaterThanOrEqual(0);
    for (const query of [
      "SELECT password FROM account",
      "SELECT token FROM session",
      "SELECT * FROM jwks",
      "SELECT value FROM verification",
      "SELECT key FROM rate_limit",
      "SELECT token_hash FROM care_group_invite",
      "SELECT token_ciphertext FROM care_group_invite",
      "SELECT * FROM care_group_invite",
      "SELECT code FROM access_code",
      "SELECT html FROM notification_outbox",
    ])
      expect([query, await refusal(staff, query)]).toEqual([query, "42501"]);

    const granted = await grantsOf(res.role);
    expect(granted.tables).toContainEqual({ table_name: "care_group", privilege_type: "SELECT" });
    expect(granted.tables.map((g) => g.table_name)).not.toContain("account");
    expect(granted.columns).toContainEqual({ table_name: "care_group_invite", column_name: "status" });
    expect(granted.columns).not.toContainEqual({
      table_name: "care_group_invite",
      column_name: "token_hash",
    });

    // The revoke's statements (before its DROP ROLE) leave nothing; the drop
    // itself would fail while any grant remained.
    await getDb()
      .transaction(async (tx) => {
        for (const statement of personalAccessSql(res.role, schemaTables()).revoke)
          await tx.execute(sql.raw(statement));
        const left = await Promise.all([
          tx.execute(sql`SELECT 1 FROM information_schema.role_table_grants WHERE grantee = ${res.role}`),
          tx.execute(sql`SELECT 1 FROM information_schema.column_privileges WHERE grantee = ${res.role}`),
        ]);
        expect(left.map((l) => l.rows)).toEqual([[], []]);
        throw new Rollback();
      })
      .catch((e: unknown) => {
        if (!(e instanceof Rollback)) throw e;
      });

    ok(await dbAccessService.revoke({ email: user.email }));
    expect(await roleRow(res.role)).toBeUndefined();
    expect(await grantsOf(res.role)).toEqual({ tables: [], columns: [] });
  }, 20_000);

  it("narrows a role granted everything before the list", async () => {
    const { user } = await createUser("db-legacy", "admin");
    const password = randomPassword();
    const first = ok(await dbAccessService.grant({ email: user.email, hours: 1, password }));
    made.add(first.role);
    // What a grant gave before slice 9.
    await getDb().execute(sql.raw(`GRANT SELECT ON ALL TABLES IN SCHEMA public TO ${ident(first.role)}`));
    ok(await dbAccessService.grant({ email: user.email, hours: 1, password }));
    const staff = await connectAs(first.role, password);
    expect(await refusal(staff, "SELECT password FROM account")).toBe("42501");
    ok(await dbAccessService.revoke({ email: user.email }));
    expect(await roleRow(first.role)).toBeUndefined();
  }, 20_000);

  it("refuses non-staff, disabled and unknown accounts, and hours past 24", async () => {
    const { user } = await createUser("db-member");
    const password = randomPassword();
    const member = await dbAccessService.grant({ email: user.email, hours: 1, password });
    expect(isError(member) && member.code).toBe("dbAccess:notStaff");

    const { user: disabled } = await createUser("db-disabled", "support");
    await getDb().execute(sql`UPDATE "user" SET disabled_at = now() WHERE id = ${disabled.id}`);
    const off = await dbAccessService.grant({ email: disabled.email, hours: 1, password });
    expect(isError(off) && off.code).toBe("dbAccess:notStaff");

    const unknown = await dbAccessService.grant({
      email: `nobody-${randomUUID()}@example.com`,
      hours: 1,
      password,
    });
    expect(isError(unknown) && unknown.code).toBe("dbAccess:unknownAddress");

    const { user: staff } = await createUser("db-hours", "admin");
    const long = await dbAccessService.grant({ email: staff.email, hours: 25, password });
    expect(isError(long) && long.code).toBe("dbAccess:invalidHours");

    for (const u of [user, disabled, staff]) expect(await entriesFor(u.id)).toHaveLength(0);
  });
});
