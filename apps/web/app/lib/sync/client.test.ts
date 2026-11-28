import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { open } from "./client";
import { closeSync, openSync } from "./index";

// The module registers its back/forward cache handler on `window` as it loads.
vi.hoisted(() => vi.stubGlobal("window", {}));

// PowerSync is faked: `open` only needs init, disconnectAndClear and connect.
// `close`, `disconnect` and `execute` (the wipe's VACUUM) for `openSync` and `closeSync`.
const disconnectAndClear = vi.fn(() => Promise.resolve());
const closed = vi.fn(() => Promise.resolve());
const vacuumed = vi.fn((_sql: string) => Promise.resolve());
vi.mock("@powersync/web", () => ({
  PowerSyncDatabase: class {
    init = () => Promise.resolve();
    disconnectAndClear = disconnectAndClear;
    connect = () => Promise.resolve();
    disconnect = () => Promise.resolve();
    close = closed;
    execute = vacuumed;
  },
}));
vi.mock("../search/search.sync", () => ({
  startSearchIndex: () => Promise.resolve(),
  stopSearchIndex: () => Promise.resolve(),
}));
vi.mock("@powersync/drizzle-driver", () => ({
  DrizzleAppSchema: class {},
  wrapPowerSyncWithDrizzle: () => ({}),
}));
vi.mock("./schema", () => ({ drizzleSchema: {}, powerSyncSchema: {} }));
vi.mock("./pageCache", () => ({ releaseSyncLocksWhenCached: () => undefined }));
vi.mock("../search/searchTables.sync", () => ({ dropSearchTables: () => Promise.resolve() }));
vi.mock("../auth/auth-client", () => ({ authClient: {} }));
vi.mock("../core/rpc", () => ({ rpc: {} }));

/** A localStorage stand-in: a Map, with `Object.keys` listing its keys as the real one does. */
const memoryStorage = () => {
  const items: Record<string, string> = {};
  return new Proxy(
    {
      getItem: (key: string) => (key in items ? items[key]! : null),
      setItem: (key: string, value: string) => {
        items[key] = String(value);
      },
      removeItem: (key: string) => {
        delete items[key];
      },
    },
    {
      ownKeys: () => Object.keys(items),
      getOwnPropertyDescriptor: () => ({ enumerable: true, configurable: true }),
    },
  );
};

/** One key per entry on the forget list, as user u1 leaves them in group g1. */
const PREVIOUS_USER_KEYS = [
  "caretook:settings:u1",
  "caretook:settings-pending:u1",
  "caretook:calendar:u1:g1",
  "caretook:calendar-pending:u1:g1",
  "caretook:lastGroup:u1",
  "caretook:recentSearches:u1",
  "caretook:recentLines:u1:g1",
  "caretook:quickEntryTips:u1",
  "caretook:easyMode:u1:g1",
];

const storedKeys = () => Object.keys(localStorage);

describe("open: the device's owner", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", memoryStorage());
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    disconnectAndClear.mockClear();
    localStorage.setItem("caretook:sync-owner", "u1");
    for (const key of PREVIOUS_USER_KEYS) localStorage.setItem(key, "fictional");
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("forgets the previous user's keys, and clears the database, when someone else signs in", async () => {
    await open("u2");
    expect(storedKeys().filter((key) => PREVIOUS_USER_KEYS.includes(key))).toEqual([]);
    expect(disconnectAndClear).toHaveBeenCalledOnce();
    expect(localStorage.getItem("caretook:sync-owner")).toBe("u2");
  });

  it("keeps the session's own keys when someone else signs in", async () => {
    localStorage.setItem("caretook:session-user", JSON.stringify({ id: "u2" }));
    await open("u2");
    expect(localStorage.getItem("caretook:session-user")).not.toBeNull();
  });

  it("keeps everything when the same user opens it again", async () => {
    await open("u1");
    expect(storedKeys()).toEqual(expect.arrayContaining(PREVIOUS_USER_KEYS));
    expect(disconnectAndClear).not.toHaveBeenCalled();
  });
});

describe("openSync: a stale tab hands over to the session's new user (B-296)", () => {
  beforeEach(async () => {
    vi.stubGlobal("window", {});
    vi.stubGlobal("localStorage", memoryStorage());
    vi.stubGlobal("fetch", () => Promise.reject(new TypeError("offline")));
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    localStorage.setItem("caretook:sync-owner", "u1");
    // This tab holds u1's database.
    await openSync("u1");
    for (const f of [disconnectAndClear, closed, vacuumed]) f.mockClear();
  });
  afterEach(async () => {
    await closeSync();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("keeps the copy when another tab already made the new user its owner", async () => {
    // Another tab signed u2 in and opened the file for them.
    localStorage.setItem("caretook:sync-owner", "u2");
    localStorage.setItem("caretook:settings-pending:u2", "fictional");
    const db = await openSync("u2");
    expect(db.userId).toBe("u2");
    expect(closed).toHaveBeenCalledOnce();
    expect(disconnectAndClear).not.toHaveBeenCalled();
    expect(vacuumed).not.toHaveBeenCalled();
    expect(localStorage.getItem("caretook:settings-pending:u2")).toBe("fictional");
  });

  it("wipes it through the owner rule when the file is still the old user's", async () => {
    localStorage.setItem("caretook:settings:u1", "fictional");
    await openSync("u2");
    expect(disconnectAndClear).toHaveBeenCalledOnce();
    // Not sign-out's wipe (which vacuums and forgets the owner): `open`'s.
    expect(vacuumed).not.toHaveBeenCalled();
    expect(localStorage.getItem("caretook:sync-owner")).toBe("u2");
    expect(localStorage.getItem("caretook:settings:u1")).toBeNull();
  });
});
