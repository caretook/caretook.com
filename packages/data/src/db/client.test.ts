import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_CONNECT_TIMEOUT_MS, getDbConfig } from "../config";
import { createPool, setPoolHook } from "./client";

// Nothing here connects: pg.Pool opens clients only on the first query.
const URL = "postgres://fictional:fictional@127.0.0.1:1/fictional";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  setPoolHook(null);
});

describe("createPool", () => {
  it("listens for idle client errors, so emitting one doesn't throw (B-342)", async () => {
    vi.stubEnv("DATABASE_URL", URL);
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const pool = createPool();

    expect(pool.listenerCount("error")).toBe(1);
    const dropped = Object.assign(new Error("Connection terminated unexpectedly"), { code: "ECONNRESET" });
    expect(() => pool.emit("error", dropped)).not.toThrow();
    expect(spy).toHaveBeenCalledOnce();
    expect(String(spy.mock.calls[0]?.[0])).not.toContain("Connection terminated unexpectedly");
    await pool.end();
  });

  it("hands each new pool to the hook (attachDatabasePool on Vercel)", async () => {
    vi.stubEnv("DATABASE_URL", URL);
    const hook = vi.fn();
    setPoolHook(hook);
    const pool = createPool();
    expect(hook).toHaveBeenCalledWith(pool);
    await pool.end();
  });
});

describe("getDbConfig's connect timeout", () => {
  it("defaults to 10 s", () => {
    vi.stubEnv("DATABASE_CONNECT_TIMEOUT_MS", "");
    expect(DEFAULT_CONNECT_TIMEOUT_MS).toBe(10_000);
    expect(getDbConfig().connectTimeoutMs).toBe(10_000);
  });

  it("is overridden by DATABASE_CONNECT_TIMEOUT_MS", async () => {
    vi.stubEnv("DATABASE_CONNECT_TIMEOUT_MS", "4500");
    vi.stubEnv("DATABASE_URL", URL);
    expect(getDbConfig().connectTimeoutMs).toBe(4500);
    const pool = createPool();
    expect(pool.options.connectionTimeoutMillis).toBe(4500);
    await pool.end();
  });
});
