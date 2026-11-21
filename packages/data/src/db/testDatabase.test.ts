import { describe, expect, it } from "vitest";
import {
  intWorkers,
  isOwnDatabase,
  maintenanceUrl,
  testDatabase,
  workerDatabase,
  workerDatabaseNames,
} from "./testDatabase";

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

describe("workerDatabase", () => {
  const shared = {
    PG_TEST_PORT: "5436",
    SHARED_TEST_DB: "1",
    DATABASE_URL: url("localhost:5436", "caretook_test_check_speed_4"),
  };
  const nameOf = (env: Parameters<typeof workerDatabase>[0]) => {
    const res = workerDatabase(env);
    return res.ok ? res.name : res.reason;
  };

  it("reads CARETOOK_INT_WORKERS: 3 by default, 1 to 16, else refused", () => {
    expect(intWorkers(undefined)).toBe(3);
    expect(intWorkers("")).toBe(3);
    expect(intWorkers("1")).toBe(1);
    expect(intWorkers("16")).toBe(16);
    for (const bad of ["0", "17", "2.5", "three", "-1"]) expect(intWorkers(bad), bad).toBeUndefined();
  });

  it("gives each worker id its own database on the same server", () => {
    const names = ["1", "2", "3"].map((id) => nameOf({ ...shared, VITEST_POOL_ID: id }));
    expect(names).toEqual([
      "caretook_test_check_speed_4_w1",
      "caretook_test_check_speed_4_w2",
      "caretook_test_check_speed_4_w3",
    ]);
    const res = workerDatabase({ ...shared, VITEST_POOL_ID: "2" });
    expect(res.ok && res.url.toString()).toBe(
      "postgresql://caretook:password@localhost:5436/caretook_test_check_speed_4_w2",
    );
    expect(workerDatabaseNames("caretook_test_x", 3)).toEqual([
      "caretook_test_x_w1",
      "caretook_test_x_w2",
      "caretook_test_x_w3",
    ]);
    // The main checkout's own test database gets copies too.
    expect(nameOf({ DATABASE_URL: url("localhost:5435"), VITEST_POOL_ID: "3" })).toBe("caretook_w3");
  });

  it("keeps a long worktree's worker names distinct and within 63 characters", () => {
    const base = `caretook_test_${"x".repeat(49)}`;
    const names = workerDatabaseNames(base, 16);
    expect(new Set(names).size).toBe(16);
    for (const n of names) {
      expect(n.length).toBeLessThanOrEqual(63);
      expect(isOwnDatabase(base, n), n).toBe(true);
    }
    expect(
      nameOf({
        ...shared,
        DATABASE_URL: url("localhost:5436", base),
        CARETOOK_INT_WORKERS: "16",
        VITEST_POOL_ID: "16",
      }),
    ).toBe(names[15]);
  });

  it("with one worker, uses the database itself", () => {
    expect(nameOf({ ...shared, CARETOOK_INT_WORKERS: "1", VITEST_POOL_ID: "1" })).toBe(
      "caretook_test_check_speed_4",
    );
    expect(workerDatabaseNames("caretook_test_x", 1)).toEqual(["caretook_test_x"]);
  });

  it("refuses a worker id outside the worker count, or a bad count", () => {
    for (const id of [undefined, "0", "4", "x"])
      expect(workerDatabase({ ...shared, VITEST_POOL_ID: id }).ok, String(id)).toBe(false);
    expect(workerDatabase({ ...shared, CARETOOK_INT_WORKERS: "99", VITEST_POOL_ID: "1" }).ok).toBe(false);
  });

  it("counts only the worktree's own suffixed names as its databases", () => {
    const base = "caretook_test_t_1";
    expect(isOwnDatabase(base, base)).toBe(true);
    expect(isOwnDatabase(base, "caretook_test_t_1_w3")).toBe(true);
    for (const other of [
      "caretook_test_t_10",
      "caretook_test_t_1_w0",
      "caretook_test_t_1_w17",
      "caretook_test_t_1_wx",
      "caretook_test_t_2_w1",
      "caretook_test_t_1_w1_w1",
      "caretook",
      "postgres",
    ])
      expect(isOwnDatabase(base, other), other).toBe(false);
  });

  it("still refuses the dev and production databases, and another worktree's", () => {
    // The dev database (:5434) and a hosted one, as a worker would see them.
    expect(workerDatabase({ DATABASE_URL: url("localhost:5434"), VITEST_POOL_ID: "1" }).ok).toBe(false);
    expect(
      workerDatabase({ DATABASE_URL: url("ep-example.us-east-2.aws.neon.tech:5432"), VITEST_POOL_ID: "1" })
        .ok,
    ).toBe(false);
    // On the shared server, a base that isn't a worktree's test database.
    for (const db of ["caretook", "postgres", "caretook_w1"])
      expect(
        workerDatabase({ ...shared, DATABASE_URL: url("localhost:5436", db), VITEST_POOL_ID: "1" }).ok,
        db,
      ).toBe(false);
  });
});
