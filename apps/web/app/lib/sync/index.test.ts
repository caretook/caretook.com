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

/** The handlers and options `watch` got on its `n`th call. */
const watchCall = (n = 0) =>
  watch.mock.calls[n] as [string, unknown[], { onResult: (r: unknown) => void }, { signal: AbortSignal }];
const result = (id: string) => ({ rows: { _array: [{ id }] } });

describe("watchLiveQuery", () => {
  /** The frame callbacks waiting to run. */
  let frames: FrameRequestCallback[];
  const runFrame = () => frames.splice(0).forEach((f) => f(0));
  beforeEach(() => {
    vi.stubGlobal("window", {});
    frames = [];
    // Each batch's fallback timer too, so none is left over for the next test.
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    vi.stubGlobal("requestAnimationFrame", (f: FrameRequestCallback) => frames.push(f));
    watch.mockReset();
  });
  afterEach(async () => {
    runFrame();
    vi.useRealTimers();
    await closeSync();
    vi.unstubAllGlobals();
  });

  it("watches the query while the database is open, and aborts on cleanup", async () => {
    await openSync("u1");
    const onRows = vi.fn();
    const stop = watchLiveQuery(KEY, onRows);
    expect(watch).toHaveBeenCalledOnce();
    const [sql, params, handlers, options] = watchCall();
    expect([sql, params]).toEqual(JSON.parse(KEY));
    handlers.onResult(result("p1"));
    runFrame();
    expect(onRows).toHaveBeenCalledWith([{ id: "p1" }]);
    stop();
    expect(options.signal.aborted).toBe(true);
  });

  it("hands over the results that came in before a frame together, at the frame (B-633)", async () => {
    await openSync("u1");
    const first = vi.fn();
    const second = vi.fn();
    watchLiveQuery(KEY, first);
    watchLiveQuery(KEY, second);
    watchCall(0)[2].onResult(result("p1"));
    watchCall(1)[2].onResult(result("p2"));
    expect(first).not.toHaveBeenCalled();
    expect(second).not.toHaveBeenCalled();
    expect(frames).toHaveLength(1);
    runFrame();
    expect(first).toHaveBeenCalledWith([{ id: "p1" }]);
    expect(second).toHaveBeenCalledWith([{ id: "p2" }]);
  });

  it("passes nothing after cleanup, even a result that came in before it", async () => {
    await openSync("u1");
    const onRows = vi.fn();
    const stop = watchLiveQuery(KEY, onRows);
    watchCall()[2].onResult(result("p1"));
    stop();
    runFrame();
    expect(onRows).not.toHaveBeenCalled();
  });

  it("on a hidden page, which runs no frames, hands them over after a short wait", async () => {
    await openSync("u1");
    const onRows = vi.fn();
    watchLiveQuery(KEY, onRows);
    watchCall()[2].onResult(result("p1"));
    vi.advanceTimersByTime(99);
    expect(onRows).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onRows).toHaveBeenCalledOnce();
    // The frame that comes later passes nothing twice.
    runFrame();
    expect(onRows).toHaveBeenCalledOnce();
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
