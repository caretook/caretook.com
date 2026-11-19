import { describe, expect, it } from "vitest";
import { maintenanceUrl, testDatabase } from "./testDatabase";

const url = (host: string, db = "caretook") => `postgresql://caretook:password@${host}/${db}`;

describe("testDatabase", () => {
  it("accepts the main checkout's test database on :5435", () => {
    expect(testDatabase({ DATABASE_URL: url("localhost:5435") })).toMatchObject({ ok: true, shared: false });
  });

  it("accepts a loop's own test port", () => {
    expect(testDatabase({ DATABASE_URL: url("127.0.0.1:6135"), PG_TEST_PORT: "6135" })).toMatchObject({
      ok: true,
    });
  });

  it("refuses another host, another port, or no URL", () => {
    expect(testDatabase({ DATABASE_URL: url("db.example.com:5435") }).ok).toBe(false);
    expect(testDatabase({ DATABASE_URL: url("localhost:5434") }).ok).toBe(false);
    expect(testDatabase({ DATABASE_URL: url("localhost:5435"), PG_TEST_PORT: "5436" }).ok).toBe(false);
    expect(testDatabase({}).ok).toBe(false);
  });

  it("on the shared server, accepts only a caretook_test_<worktree> database", () => {
    const shared = { PG_TEST_PORT: "5436", SHARED_TEST_DB: "1" };
    expect(
      testDatabase({ ...shared, DATABASE_URL: url("localhost:5436", "caretook_test_orchestration_5") }),
    ).toMatchObject({ ok: true, shared: true, name: "caretook_test_orchestration_5" });
    for (const db of [
      "caretook",
      "postgres",
      "caretook_test_",
      "caretook_test_A-b",
      "other_caretook_test_x",
    ]) {
      const res = testDatabase({ ...shared, DATABASE_URL: url("localhost:5436", db) });
      expect(res.ok, db).toBe(false);
    }
  });

  it("points maintenance at the same server's postgres database", () => {
    expect(maintenanceUrl(new URL(url("localhost:5436", "caretook_test_x")))).toBe(
      "postgresql://caretook:password@localhost:5436/postgres",
    );
  });
});
