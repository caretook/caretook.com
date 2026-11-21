import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { closeSync, openSync, syncUserId, watchLiveQuery } from "./index";
import { recall, remember } from "./remembered";

// The database is faked: watchLiveQuery only needs `powersync.watch`.
const watch = vi.fn();
vi.mock("./client", () => ({
  open: (userId: string) => Promise.resolve({ userId, powersync: { watch } }),
  clear: () => Promise.resolve(),
}));

const KEY = JSON.stringify(["SELECT * FROM provider WHERE group_id = ?", ["g1"]]);

describe("watchLiveQuery", () => {
  beforeEach(() => {
    vi.stubGlobal("window", {});
    watch.mockReset();
  });
  afterEach(async () => {
    await closeSync();
    vi.unstubAllGlobals();
  });

  it("watches the query while the database is open, and aborts on cleanup", async () => {
    await openSync("u1");
    const onRows = vi.fn();
    const stop = watchLiveQuery(KEY, onRows);
    expect(watch).toHaveBeenCalledOnce();
    const [sql, params, handlers, options] = watch.mock.calls[0] as [
      string,
      unknown[],
      { onResult: (r: unknown) => void },
      { signal: AbortSignal },
    ];
    expect([sql, params]).toEqual(JSON.parse(KEY));
    handlers.onResult({ rows: { _array: [{ id: "p1" }] } });
    expect(onRows).toHaveBeenCalledWith([{ id: "p1" }]);
    stop();
    expect(options.signal.aborted).toBe(true);
  });

  it("watches nothing, and doesn't throw, once sign-out has closed the database", async () => {
    await openSync("u1");
    await closeSync();
    const onRows = vi.fn();
    let stop = () => {};
    expect(() => (stop = watchLiveQuery(KEY, onRows))).not.toThrow();
    expect(watch).not.toHaveBeenCalled();
    expect(stop).not.toThrow();
    expect(onRows).not.toHaveBeenCalled();
  });
});

describe("sign-out", () => {
  beforeEach(() => vi.stubGlobal("window", {}));
  afterEach(() => vi.unstubAllGlobals());

  it("forgets the tiles' remembered answers with the local copy", async () => {
    await openSync("u1");
    expect(syncUserId()).toBe("u1");
    remember("u1", { groupId: "g1", name: "dueTodos" }, [{ id: "t1" }]);
    await closeSync();
    expect(syncUserId()).toBeNull();
    expect(recall("u1", { groupId: "g1", name: "dueTodos" })).toBeUndefined();
  });

  it("forgets them when another user's database opens on this tab", async () => {
    await openSync("u1");
    remember("u1", { groupId: "g1", name: "dueTodos" }, [{ id: "t1" }]);
    await openSync("u2");
    expect(recall("u1", { groupId: "g1", name: "dueTodos" })).toBeUndefined();
    await closeSync();
  });
});
