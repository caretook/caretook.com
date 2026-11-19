import { describe, expect, it } from "vitest";
import { auditPageCount, auditSearch, hasAuditFilters, parseAuditSearch } from "./auditFilters";

const ACTOR = "0b6f3c1e-5d1a-4c2e-9a77-3f1d2b8a0001";

describe("parseAuditSearch", () => {
  it("reads every filter and the page", () => {
    expect(
      parseAuditSearch(
        `?actor=${ACTOR}&target=sam%40example.com&action=accessCode.create&from=2026-11-01&to=2026-11-19&page=3`,
      ),
    ).toEqual({
      filter: {
        actorId: ACTOR,
        target: "sam@example.com",
        action: "accessCode.create",
        from: "2026-11-01",
        to: "2026-11-19",
      },
      page: 3,
    });
  });

  it("drops values that aren't valid", () => {
    expect(parseAuditSearch("?actor=nobody&action=user.delete&from=yesterday&to=2026-13-40&page=0")).toEqual({
      filter: {},
      page: 1,
    });
  });

  it("trims and caps the target", () => {
    expect(parseAuditSearch(`?target=${"a".repeat(300)}`).filter.target).toHaveLength(254);
    expect(parseAuditSearch("?target=%20%20").filter.target).toBeUndefined();
  });
});

describe("auditSearch", () => {
  it("round-trips through parseAuditSearch", () => {
    const filter = { actorId: ACTOR, target: "Dev Family", action: "user.view" as const, from: "2026-11-01" };
    expect(parseAuditSearch(auditSearch(filter, 2))).toEqual({ filter, page: 2 });
  });

  it("leaves out page 1 and empty filters", () => {
    expect(auditSearch({})).toBe("");
    expect(auditSearch({ target: "x" }, 1)).toBe("?target=x");
  });
});

describe("hasAuditFilters and auditPageCount", () => {
  it("say whether anything filters and how many pages there are", () => {
    expect(hasAuditFilters({})).toBe(false);
    expect(hasAuditFilters({ action: "accessCode.revoke" })).toBe(true);
    expect(auditPageCount(0, 50)).toBe(1);
    expect(auditPageCount(101, 50)).toBe(3);
  });
});
