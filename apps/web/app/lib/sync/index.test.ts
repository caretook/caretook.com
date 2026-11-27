import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { closeSync, openSync, sameRows, syncUserId, watchLiveQuery } from "./index";
import { recall, remember } from "./remembered";

// The database is faked: watchLiveQuery only needs `powersync.watch`.
const watch = vi.fn();
const opened = vi.fn();
vi.mock("./client", () => ({
  open: (userId: string) => {
    opened(userId);
    return Promise.resolve({ userId, powersync: { watch } });
  },
  clear: () => Promise.resolve(),
}));

const KEY = JSON.stringify(["SELECT * FROM provider WHERE group_id = ?", ["g1"]]);
const OTHER = JSON.stringify(["SELECT * FROM medication WHERE group_id = ?", ["g1"]]);
const THIRD = JSON.stringify(["SELECT * FROM todo WHERE group_id = ?", ["g1"]]);

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
    watchLiveQuery(OTHER, second);
    watchCall(0)[2].onResult(result("p1"));
    watchCall(1)[2].onResult(result("m1"));
    expect(first).not.toHaveBeenCalled();
    expect(second).not.toHaveBeenCalled();
    expect(frames).toHaveLength(1);
    runFrame();
    expect(first).toHaveBeenCalledWith([{ id: "p1" }]);
    expect(second).toHaveBeenCalledWith([{ id: "m1" }]);
  });

  it("holds the frame while another watch's first result is owed, then hands them over together (B-870)", async () => {
    await openSync("u1");
    const first = vi.fn();
    const second = vi.fn();
    watchLiveQuery(KEY, first);
    watchLiveQuery(OTHER, second);
    watchCall(0)[2].onResult(result("p1"));
    runFrame();
    expect(first).not.toHaveBeenCalled();
    // The hidden page's timer holds too.
    vi.advanceTimersByTime(100);
    expect(first).not.toHaveBeenCalled();
    watchCall(1)[2].onResult(result("m1"));
    runFrame();
    expect(first).toHaveBeenCalledWith([{ id: "p1" }]);
    expect(second).toHaveBeenCalledWith([{ id: "m1" }]);
  });

  it("holds no longer than the cap for a first result that doesn't come, nor for a watch cleaned up", async () => {
    await openSync("u1");
    const now = vi.spyOn(performance, "now").mockReturnValue(1000);
    const onRows = vi.fn();
    watchLiveQuery(KEY, onRows);
    watchLiveQuery(OTHER, vi.fn());
    const stop = watchLiveQuery(THIRD, vi.fn());
    watchCall(0)[2].onResult(result("p1"));
    runFrame();
    expect(onRows).not.toHaveBeenCalled();
    now.mockReturnValue(1500);
    runFrame();
    expect(onRows).toHaveBeenCalledOnce();

    // The next result waits again while the second watch's is owed, but not for the third's once it's stopped.
    watchCall(0)[2].onResult(result("p2"));
    watchCall(1)[2].onResult(result("m1"));
    stop();
    runFrame();
    expect(onRows).toHaveBeenLastCalledWith([{ id: "p2" }]);
    now.mockRestore();
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

describe("shared watches (B-910)", () => {
  let frames: FrameRequestCallback[];
  const runFrame = () => frames.splice(0).forEach((f) => f(0));
  beforeEach(() => {
    vi.stubGlobal("window", {});
    frames = [];
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

  it("opens one watch for the same SQL and params, updates both, and closes it after both leave", async () => {
    await openSync("u1");
    const first = vi.fn();
    const second = vi.fn();
    const stopFirst = watchLiveQuery(KEY, first);
    const stopSecond = watchLiveQuery(KEY, second);
    expect(watch).toHaveBeenCalledOnce();
    const [, , handlers, options] = watchCall();
    handlers.onResult(result("p1"));
    runFrame();
    expect(first).toHaveBeenCalledWith([{ id: "p1" }]);
    expect(second).toHaveBeenCalledWith([{ id: "p1" }]);
    handlers.onResult(result("p2"));
    runFrame();
    expect(first).toHaveBeenLastCalledWith([{ id: "p2" }]);
    expect(second).toHaveBeenLastCalledWith([{ id: "p2" }]);

    stopFirst();
    expect(options.signal.aborted).toBe(false);
    handlers.onResult(result("p3"));
    runFrame();
    expect(first).toHaveBeenCalledTimes(2);
    expect(second).toHaveBeenLastCalledWith([{ id: "p3" }]);
    stopSecond();
    expect(options.signal.aborted).toBe(true);

    // The next subscriber opens a new one.
    watchLiveQuery(KEY, vi.fn());
    expect(watch).toHaveBeenCalledTimes(2);
  });

  it("opens two for different params", async () => {
    await openSync("u1");
    watchLiveQuery(JSON.stringify(["SELECT * FROM provider WHERE group_id = ?", ["g1"]]), vi.fn());
    watchLiveQuery(JSON.stringify(["SELECT * FROM provider WHERE group_id = ?", ["g2"]]), vi.fn());
    expect(watch).toHaveBeenCalledTimes(2);
  });

  it("hands a late subscriber the current rows at once, and the same result no second time", async () => {
    await openSync("u1");
    watchLiveQuery(KEY, vi.fn());
    watchCall()[2].onResult(result("p1"));
    const late = vi.fn();
    watchLiveQuery(KEY, late);
    expect(late).toHaveBeenCalledWith([{ id: "p1" }]);
    runFrame();
    expect(late).toHaveBeenCalledOnce();
    watchCall()[2].onResult(result("p2"));
    runFrame();
    expect(late).toHaveBeenLastCalledWith([{ id: "p2" }]);
    expect(watch).toHaveBeenCalledOnce();
  });

  it("passes nothing to a subscriber that left before the frame", async () => {
    await openSync("u1");
    const stays = vi.fn();
    const leaves = vi.fn();
    watchLiveQuery(KEY, stays);
    const stop = watchLiveQuery(KEY, leaves);
    watchCall()[2].onResult(result("p1"));
    stop();
    runFrame();
    expect(stays).toHaveBeenCalledOnce();
    expect(leaves).not.toHaveBeenCalled();
  });

  it("closes every watch at sign-out, so the next user's database opens its own", async () => {
    await openSync("u1");
    const stop = watchLiveQuery(KEY, vi.fn());
    const options = watchCall()[3];
    await closeSync();
    expect(options.signal.aborted).toBe(true);
    await openSync("u2");
    watchLiveQuery(KEY, vi.fn());
    expect(watch).toHaveBeenCalledTimes(2);
    // The first user's screen cleaning up later closes nothing of the second's.
    stop();
    expect(watchCall(1)[3].signal.aborted).toBe(false);
  });
});

describe("identical answers (B-956)", () => {
  let frames: FrameRequestCallback[];
  const runFrame = () => frames.splice(0).forEach((f) => f(0));
  const rows = (...r: Record<string, unknown>[]) => ({ rows: { _array: r } });
  beforeEach(() => {
    vi.stubGlobal("window", {});
    frames = [];
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

  it("delivers the first answer, then nothing for one with the same rows, so no state is set", async () => {
    await openSync("u1");
    const onRows = vi.fn();
    watchLiveQuery(KEY, onRows);
    const { onResult } = watchCall()[2];
    onResult(rows({ id: "p1", name: "Dr. Example" }));
    runFrame();
    expect(onRows).toHaveBeenCalledOnce();
    // A fresh array of fresh row objects, as PowerSync hands back on a rerun.
    onResult(rows({ id: "p1", name: "Dr. Example" }));
    runFrame();
    vi.advanceTimersByTime(100);
    expect(onRows).toHaveBeenCalledOnce();
    expect(frames).toHaveLength(0);
  });

  it("delivers a changed row, an added row and a removed row", async () => {
    await openSync("u1");
    const onRows = vi.fn();
    watchLiveQuery(KEY, onRows);
    const { onResult } = watchCall()[2];
    onResult(rows({ id: "p1", name: "A" }));
    runFrame();
    onResult(rows({ id: "p1", name: "B" }));
    runFrame();
    expect(onRows).toHaveBeenLastCalledWith([{ id: "p1", name: "B" }]);
    onResult(rows({ id: "p1", name: "B" }, { id: "p2", name: "C" }));
    runFrame();
    expect(onRows).toHaveBeenLastCalledWith([
      { id: "p1", name: "B" },
      { id: "p2", name: "C" },
    ]);
    onResult(rows({ id: "p2", name: "C" }));
    runFrame();
    expect(onRows).toHaveBeenLastCalledWith([{ id: "p2", name: "C" }]);
    expect(onRows).toHaveBeenCalledTimes(4);
  });

  it("delivers an empty first answer, and a late subscriber still gets the current rows at once", async () => {
    await openSync("u1");
    const first = vi.fn();
    watchLiveQuery(KEY, first);
    const { onResult } = watchCall()[2];
    onResult(rows());
    runFrame();
    expect(first).toHaveBeenCalledWith([]);
    onResult(rows());
    const late = vi.fn();
    watchLiveQuery(KEY, late);
    expect(late).toHaveBeenCalledWith([]);
    runFrame();
    expect(first).toHaveBeenCalledOnce();
    expect(late).toHaveBeenCalledOnce();
  });
});

describe("sameRows", () => {
  it("compares the count, then each row's columns", () => {
    expect(sameRows([], [])).toBe(true);
    expect(sameRows([{ a: 1, b: null }], [{ a: 1, b: null }])).toBe(true);
    expect(sameRows([{ a: 1 }], [{ a: 1 }, { a: 2 }])).toBe(false);
    expect(sameRows([{ a: 1 }], [{ a: "1" }])).toBe(false);
    expect(sameRows([{ a: 1 }], [{ a: 1, b: 2 }])).toBe(false);
    expect(sameRows([{ a: 1, b: undefined }], [{ a: 1, c: undefined }])).toBe(false);
    expect(sameRows([{ a: 1 }, { a: 2 }], [{ a: 2 }, { a: 1 }])).toBe(false);
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

describe("the SQLite download (B-959)", () => {
  const fetches = vi.fn(() => Promise.resolve(new Response("wasm")));
  beforeEach(() => {
    vi.stubGlobal("window", {});
    vi.stubGlobal("fetch", fetches);
    fetches.mockClear();
    opened.mockClear();
  });
  afterEach(async () => {
    await closeSync();
    vi.unstubAllGlobals();
  });

  it("starts as the database starts opening, before PowerSync's worker asks for it", async () => {
    const opening = openSync("u1");
    expect(fetches).toHaveBeenCalledOnce();
    expect(opened).not.toHaveBeenCalled();
    const [url, init] = fetches.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toMatch(/wa-sqlite-async\.wasm/);
    expect(init.priority).toBe("high");
    await opening;
    expect(opened).toHaveBeenCalledWith("u1");
  });

  it("starts once per database, not for each caller of the open one", async () => {
    await Promise.all([openSync("u1"), openSync("u1")]);
    await openSync("u1");
    expect(fetches).toHaveBeenCalledOnce();
    await closeSync();
    await openSync("u2");
    expect(fetches).toHaveBeenCalledTimes(2);
  });

  it("leaves the opening alone when the download fails", async () => {
    fetches.mockImplementationOnce(() => Promise.reject(new TypeError("offline")));
    await expect(openSync("u1")).resolves.toMatchObject({ userId: "u1" });
  });
});
