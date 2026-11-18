import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import { isError } from "../../errors";
import {
  filterToSql,
  generateOrderBy,
  generateQueryWhere,
  isFilterEmpty,
  paginate,
  scopeToSql,
} from "./queryHelpers";

const dialect = new PgDialect();
const render = (sql: Parameters<PgDialect["sqlToQuery"]>[0]) => dialect.sqlToQuery(sql);

describe("filterToSql", () => {
  it("ANDs top-level fields into parameterized SQL", () => {
    const where = filterToSql("userSchema", {
      email: { type: "eq", value: "a@example.com" },
      role: { type: "inArray", value: ["admin", "member"] },
    });
    if (!where || isError(where)) throw new Error("expected SQL");
    const query = render(where);
    expect(query.sql).toBe('("user"."email" = $1 and "user"."role" in ($2, $3))');
    expect(query.params).toEqual(["a@example.com", "admin", "member"]);
  });

  it("rejects unknown fields (they could come from API callers)", () => {
    const where = filterToSql("userSchema", { nope: { type: "eq", value: 1 } } as never);
    expect(isError(where) && where.code).toBe("baseModel:filter:unknownField");
  });

  it("rejects empty and/or groups", () => {
    const where = filterToSql("userSchema", { name: { type: "or", value: [] } });
    expect(isError(where) && where.code).toBe("baseModel:filter:emptyGroup");
  });
});

describe("scopeToSql", () => {
  it("is unrestricted for `all`", () => {
    expect(scopeToSql("userSchema", { type: "all" })).toBeUndefined();
  });

  it("turns a group rule into a membership subquery filtered by role", () => {
    const where = scopeToSql("careRecipientSchema", {
      type: "rules",
      rules: [{ type: "group", field: "groupId", userId: "u1", groupRoles: ["owner", "admin"] }],
    });
    if (!where) throw new Error("expected SQL");
    const query = render(where);
    // The subquery's select column is unqualified; Postgres resolves it to
    // the nearest FROM (scope_member), even when the outer table is also
    // care_group_member.
    expect(query.sql).toBe(
      '"care_recipient"."group_id" in (select "group_id" from "care_group_member" "scope_member" ' +
        'where ("scope_member"."user_id" = $1 and "scope_member"."role" in ($2, $3)))',
    );
    expect(query.params).toEqual(["u1", "owner", "admin"]);
  });

  it("ORs several rules", () => {
    const where = scopeToSql("careGroupMemberSchema", {
      type: "rules",
      rules: [
        { type: "owned", field: "userId", userId: "u1" },
        { type: "group", field: "groupId", userId: "u1", groupRoles: ["owner"] },
      ],
    });
    if (!where) throw new Error("expected SQL");
    expect(render(where).sql).toMatch(/^\("care_group_member"."user_id" = \$1 or /);
  });

  it("throws on a misconfigured field instead of widening access", () => {
    expect(() =>
      scopeToSql("userSchema", { type: "rules", rules: [{ type: "owned", field: "missing", userId: "u1" }] }),
    ).toThrow(/not found/);
  });
});

describe("generateQueryWhere", () => {
  it("returns the permission error instead of a query when access is denied", () => {
    const where = generateQueryWhere("careGroupInviteSchema", "list", { authUser: null });
    expect(isError(where) && where.code).toBe("permissions:unauthenticated");
  });
});

describe("generateOrderBy", () => {
  it("defaults to createdAt then id for stable pagination", () => {
    const order = generateOrderBy("userSchema");
    if (isError(order)) throw order;
    expect(order.map((o) => render(o).sql)).toEqual(['"user"."created_at" asc', '"user"."id" asc']);
  });

  it("rejects unknown fields", () => {
    const order = generateOrderBy("userSchema", [{ field: "nope" as never, direction: "asc" }]);
    expect(isError(order) && order.code).toBe("baseModel:orderBy:unknownField");
  });
});

describe("paginate", () => {
  it("clamps page size and page number", () => {
    expect(paginate({ paginate: { limit: 10_000, page: 0 } })).toEqual({ limit: 100, offset: 0 });
    expect(paginate({ paginate: { limit: 20, page: 3 } })).toEqual({ limit: 20, offset: 40 });
    expect(paginate({})).toEqual({});
  });
});

describe("isFilterEmpty", () => {
  it("treats missing and all-undefined filters as empty", () => {
    expect(isFilterEmpty()).toBe(true);
    expect(isFilterEmpty({ id: undefined })).toBe(true);
    expect(isFilterEmpty({ id: { type: "eq", value: "x" } })).toBe(false);
  });
});
