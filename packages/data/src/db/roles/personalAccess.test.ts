import { describe, expect, it } from "vitest";
import {
  PERSONAL_ACCESS_EXCLUDED,
  personalAccessGrants,
  personalAccessProblems,
  personalAccessSql,
  schemaTables,
} from ".";

// Personal access without the secrets (hosting slice 9, B-159): the list
// covers every secret-looking table and column in the Drizzle schema, and
// the grants and revokes it makes.

describe("PERSONAL_ACCESS_EXCLUDED", () => {
  it("covers every secret-looking table and column in the schema, and names nothing stale", () => {
    expect(personalAccessProblems(schemaTables())).toEqual([]);
  });

  it("keeps out the auth tables, the rate limits and the invites' tokens", () => {
    const { tables, columns } = personalAccessGrants(schemaTables());
    for (const table of ["account", "session", "verification", "jwks", "rate_limit", "rate_limit_hit"]) {
      expect(tables).not.toContain(table);
      expect(columns[table]).toBeUndefined();
    }
    expect(columns.care_group_invite).toContain("status");
    expect(columns.care_group_invite).not.toContain("token_hash");
    expect(columns.care_group_invite).not.toContain("token_ciphertext");
    expect(tables).toEqual(
      expect.arrayContaining(["care_group", "timeline_entry", "user", "admin_audit_log"]),
    );
  });

  it("fails on a new secret-looking column or table, and on a stale entry", () => {
    const tables = {
      ...schemaTables(),
      widget: ["id", "api_token"],
      client_secret: ["id"],
    };
    expect(personalAccessProblems(tables)).toEqual([
      expect.stringMatching(/^column widget\.api_token looks secret/),
      expect.stringMatching(/^table client_secret looks secret/),
    ]);

    const withoutInvites = Object.fromEntries(
      Object.entries(schemaTables()).filter(([t]) => t !== "care_group_invite"),
    );
    expect(personalAccessProblems(withoutInvites)).toEqual([
      "care_group_invite.token_hash is listed but not in the schema",
      "care_group_invite.token_ciphertext is listed but not in the schema",
    ]);
  });

  it("is plain names", () => {
    for (const entry of PERSONAL_ACCESS_EXCLUDED) expect(entry).toMatch(/^[a-z_]+(\.[a-z_]+)?$/);
  });
});

describe("personalAccessSql", () => {
  const TABLES = {
    note: ["id", "body"],
    invite: ["id", "token_hash", "status"],
    account: ["id", "password"],
  };

  it("grants whole tables and column lists, and revokes exactly those", () => {
    const sql = personalAccessSql("staff_pat", {
      ...TABLES,
      care_group_invite: ["id", "token_hash", "token_ciphertext", "status"],
    });
    expect(sql.grant).toEqual([
      `REVOKE ALL ON ALL TABLES IN SCHEMA public FROM "staff_pat"`,
      `GRANT SELECT ON "note", "invite" TO "staff_pat"`,
      `GRANT SELECT ("id", "status") ON "care_group_invite" TO "staff_pat"`,
    ]);
    expect(sql.revoke).toEqual([
      `REVOKE SELECT ("id", "status") ON "care_group_invite" FROM "staff_pat"`,
      `REVOKE SELECT ON "note", "invite" FROM "staff_pat"`,
      `REVOKE ALL ON ALL TABLES IN SCHEMA public FROM "staff_pat"`,
    ]);
  });
});
