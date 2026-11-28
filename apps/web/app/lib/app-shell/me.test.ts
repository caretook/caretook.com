import { ORPCError } from "@orpc/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { appUrls } from "./appUrls";

const api = vi.hoisted(() => ({ get: vi.fn(), updatePreferences: vi.fn() }));
vi.mock("../core/rpc", () => ({ rpc: { me: api } }));

const {
  cachedSettings,
  forgetSettings,
  loadSettings,
  saveSettings,
  settingsKnown,
  startSettings,
  subscribeSettings,
} = await import("./me");

const USER = "u1";
const request = new Request(`http://localhost${appUrls.timeline("g")}`);
const offline = () => new TypeError("Failed to fetch");
const serverSettings = (timelineView: "rows" | "cards") => ({
  units: { temperature: "f", weight: "lb", glucose: "mg/dL", volume: "mL" },
  timelineView,
});

const store = new Map<string, string>();
const stubStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
  key: (i: number) => [...store.keys()][i] ?? null,
  get length() {
    return store.size;
  },
};
// `Object.keys(localStorage)` lists the stored keys, as in a browser.
vi.stubGlobal(
  "localStorage",
  new Proxy(stubStorage, {
    ownKeys: () => [...store.keys()],
    getOwnPropertyDescriptor: (_t, k) =>
      typeof k === "string" && store.has(k)
        ? { enumerable: true, configurable: true, value: store.get(k) }
        : undefined,
  }),
);

const pending = () => JSON.parse(store.get(`caretook:settings-pending:${USER}`) ?? "null") as unknown;
const cached = () =>
  JSON.parse(store.get(`caretook:settings:${USER}`) ?? "null") as { timelineView?: string };

beforeEach(() => {
  forgetSettings();
  store.clear();
  api.get.mockReset();
  api.updatePreferences.mockReset();
});

describe("saveSettings", () => {
  it("saves straight away online, leaving nothing pending", async () => {
    api.updatePreferences.mockResolvedValue({});
    expect(await saveSettings(USER, { timelineView: "cards" })).toBe("saved");
    expect(api.updatePreferences).toHaveBeenCalledWith({ timelineView: "cards" });
    expect(cached()?.timelineView).toBe("cards");
    expect(pending()).toBeNull();
  });

  it("keeps the change pending when offline", async () => {
    api.updatePreferences.mockRejectedValue(offline());
    expect(await saveSettings(USER, { timelineView: "cards" })).toBe("pending");
    expect(cached()?.timelineView).toBe("cards");
    expect(pending()).toEqual({ timelineView: "cards" });
  });

  it("propagates an API error and drops the refused change", async () => {
    const refused = new ORPCError("BAD_REQUEST");
    api.updatePreferences.mockRejectedValue(refused);
    await expect(saveSettings(USER, { timelineView: "cards" })).rejects.toBe(refused);
    expect(pending()).toBeNull();
  });

  it("keeps a later change pending when an earlier one lands", async () => {
    let finish!: () => void;
    api.updatePreferences.mockReturnValueOnce(new Promise<void>((r) => (finish = r)));
    const first = saveSettings(USER, { timelineView: "cards" });
    api.updatePreferences.mockRejectedValueOnce(offline());
    await saveSettings(USER, { timelineView: "rows" });
    finish();
    await first;
    expect(pending()).toEqual({ timelineView: "rows" });
  });
});

describe("loadSettings", () => {
  it("reads the server's settings and caches them", async () => {
    api.get.mockResolvedValue(serverSettings("cards"));
    expect((await loadSettings(request, USER)).timelineView).toBe("cards");
    expect(api.updatePreferences).not.toHaveBeenCalled();
    expect(cached()?.timelineView).toBe("cards");
  });

  it("offline, returns the cache with the pending change on top", async () => {
    api.updatePreferences.mockRejectedValue(offline());
    api.get.mockRejectedValue(offline());
    await saveSettings(USER, { timelineView: "cards" });
    store.set(`caretook:settings:${USER}`, JSON.stringify(serverSettings("rows")));
    expect((await loadSettings(request, USER)).timelineView).toBe("cards");
    expect(api.get).not.toHaveBeenCalled();
    expect(pending()).toEqual({ timelineView: "cards" });
  });

  it("sends a pending change first when back online", async () => {
    api.updatePreferences.mockRejectedValueOnce(offline());
    await saveSettings(USER, { timelineView: "cards" });
    api.updatePreferences.mockResolvedValue({});
    api.get.mockResolvedValue(serverSettings("cards"));
    expect((await loadSettings(request, USER)).timelineView).toBe("cards");
    await vi.waitFor(() => expect(api.get).toHaveBeenCalled());
    expect(api.updatePreferences).toHaveBeenLastCalledWith({ timelineView: "cards" });
    expect(api.updatePreferences.mock.invocationCallOrder[1]).toBeLessThan(
      api.get.mock.invocationCallOrder[0] ?? 0,
    );
    await vi.waitFor(() => expect(pending()).toBeNull());
  });

  it("drops a pending change the server refuses, and uses the server's copy", async () => {
    store.set(`caretook:settings-pending:${USER}`, JSON.stringify({ timelineView: "grid" }));
    api.updatePreferences.mockRejectedValue(new ORPCError("BAD_REQUEST"));
    api.get.mockResolvedValue(serverSettings("rows"));
    expect((await loadSettings(request, USER)).timelineView).toBe("rows");
    expect(pending()).toBeNull();
  });

  it("upgrades a change queued before the easy rename, sends it and clears it (B-472)", async () => {
    store.set(
      `caretook:settings-pending:${USER}`,
      JSON.stringify({ simpleMode: "simple", timelineView: "cards" }),
    );
    store.set(`caretook:settings:${USER}`, JSON.stringify(serverSettings("rows")));
    api.updatePreferences.mockResolvedValue({});
    api.get.mockResolvedValue({ ...serverSettings("cards"), easyMode: "easy" });
    const settings = await loadSettings(request, USER);
    expect(settings).toMatchObject({ easyMode: "easy", timelineView: "cards" });
    await vi.waitFor(() => expect(api.get).toHaveBeenCalled());
    expect(api.updatePreferences).toHaveBeenCalledWith({ timelineView: "cards", easyMode: "easy" });
    await vi.waitFor(() => expect(pending()).toBeNull());
  });

  it("keeps an old full setting, drops an unknown one, and lets a newer easyMode win", async () => {
    const key = `caretook:settings-pending:${USER}`;
    api.updatePreferences.mockRejectedValue(offline());
    api.get.mockRejectedValue(offline());
    store.set(`caretook:settings:${USER}`, JSON.stringify(serverSettings("rows")));

    store.set(key, JSON.stringify({ simpleMode: "full" }));
    await loadSettings(request, USER);
    expect(pending()).toEqual({ easyMode: "full" });

    store.set(key, JSON.stringify({ simpleMode: "tiny", timelineView: "cards" }));
    await loadSettings(request, USER);
    expect(pending()).toEqual({ timelineView: "cards" });

    store.set(key, JSON.stringify({ simpleMode: "simple", easyMode: "full" }));
    await loadSettings(request, USER);
    expect(pending()).toEqual({ easyMode: "full" });

    store.set(key, JSON.stringify({ simpleMode: "tiny" }));
    await loadSettings(request, USER);
    expect(pending()).toBeNull();
  });

  it("propagates a non-network error", async () => {
    api.get.mockRejectedValue(new ORPCError("INTERNAL_SERVER_ERROR"));
    await expect(loadSettings(request, USER)).rejects.toBeInstanceOf(ORPCError);
  });

  it("sends a lost session to sign-in, keeping the pending change", async () => {
    store.set(`caretook:settings-pending:${USER}`, JSON.stringify({ timelineView: "cards" }));
    api.updatePreferences.mockRejectedValue(new ORPCError("UNAUTHORIZED"));
    await expect(loadSettings(request, USER)).rejects.toBeInstanceOf(Response);
    expect(pending()).toEqual({ timelineView: "cards" });
  });
});

describe("dismissed setup cards", () => {
  const [A, B] = ["group-a", "group-b"];

  it("adds to the list offline, and sends only what's still pending", async () => {
    api.updatePreferences.mockRejectedValue(offline());
    await saveSettings(USER, { setupDismissed: [A] });
    await saveSettings(USER, { setupDismissed: [B] });
    expect(pending()).toEqual({ setupDismissed: [A, B] });
    expect(cachedSettings(USER).setupDismissed).toEqual([A, B]);

    api.updatePreferences.mockResolvedValue({});
    await saveSettings(USER, { setupDismissed: [A] });
    expect(pending()).toEqual({ setupDismissed: [B] });
  });

  it("keeps a pending dismissal on top of the server's list", () => {
    store.set(`caretook:settings:${USER}`, JSON.stringify({ setupDismissed: [A] }));
    store.set(`caretook:settings-pending:${USER}`, JSON.stringify({ setupDismissed: [B] }));
    expect(cachedSettings(USER).setupDismissed).toEqual([A, B]);
  });
});

describe("the group setup record", () => {
  const [A, B] = ["group-a", "group-b"];

  it("adds to each group offline, and sends only what's still pending", async () => {
    api.updatePreferences.mockRejectedValue(offline());
    await saveSettings(USER, { groupSetup: { [A]: { opened: true } } });
    await saveSettings(USER, { groupSetup: { [A]: { retired: ["help"] }, [B]: { retired: ["entry"] } } });
    expect(pending()).toEqual({
      groupSetup: { [A]: { opened: true, retired: ["help"] }, [B]: { retired: ["entry"] } },
    });

    api.updatePreferences.mockResolvedValue({});
    await saveSettings(USER, { groupSetup: { [A]: { opened: true }, [B]: { retired: ["entry"] } } });
    expect(pending()).toEqual({ groupSetup: { [A]: { retired: ["help"] } } });
    expect(cachedSettings(USER).groupSetup).toEqual({
      [A]: { opened: true, retired: ["help"] },
      [B]: { retired: ["entry"] },
    });
  });

  it("merges a pending change over a refreshed copy without losing either", async () => {
    store.set(`caretook:settings:${USER}`, JSON.stringify({ groupSetup: { [A]: { opened: true } } }));
    let answer!: (value: unknown) => void;
    api.get.mockReturnValue(new Promise((resolve) => (answer = resolve)));
    await loadSettings(request, USER);
    api.updatePreferences.mockRejectedValue(offline());
    await saveSettings(USER, { groupSetup: { [A]: { retired: ["help"] } } });
    answer({ ...serverSettings("rows"), groupSetup: { [A]: { opened: true }, [B]: { opened: true } } });
    await vi.waitFor(() => expect(cached()).toMatchObject({ groupSetup: { [B]: { opened: true } } }));
    expect(cachedSettings(USER).groupSetup).toEqual({
      [A]: { opened: true, retired: ["help"] },
      [B]: { opened: true },
    });
    expect(pending()).toEqual({ groupSetup: { [A]: { retired: ["help"] } } });
  });
});

describe("settingsKnown", () => {
  it("is unknown with no cache until the server answers, then says so", async () => {
    expect(settingsKnown(USER)).toBe(false);
    api.get.mockRejectedValue(offline());
    await loadSettings(request, USER);
    expect(settingsKnown(USER)).toBe(false);

    api.get.mockResolvedValue(serverSettings("rows"));
    const heard = vi.fn();
    const stop = subscribeSettings(heard);
    await loadSettings(request, USER);
    expect(settingsKnown(USER)).toBe(true);
    expect(heard).toHaveBeenCalled();
    stop();
  });

  it("isn't known from a change saved offline on a new device", async () => {
    api.updatePreferences.mockRejectedValue(offline());
    await saveSettings(USER, { timelineView: "cards" });
    expect(cached()?.timelineView).toBe("cards");
    expect(settingsKnown(USER)).toBe(false);
  });

  it("isn't known once the cache is gone, though this page heard the server (storage cleared or refusing writes)", async () => {
    api.get.mockResolvedValue(serverSettings("rows"));
    await loadSettings(request, USER);
    expect(settingsKnown(USER)).toBe(true);
    store.clear();
    expect(settingsKnown(USER)).toBe(false);
  });

  it("stays known on a later visit, offline, until sign-out", async () => {
    api.get.mockResolvedValue(serverSettings("rows"));
    await loadSettings(request, USER);
    const kept = new Map(store);
    forgetSettings();
    expect(settingsKnown(USER)).toBe(false);

    // A later visit: what the earlier one stored, a fresh page, no connection.
    for (const [key, value] of kept) store.set(key, value);
    api.get.mockRejectedValue(offline());
    await loadSettings(request, USER);
    expect(settingsKnown(USER)).toBe(true);
  });
});

describe("loadSettings, cache first", () => {
  afterEach(() => vi.useRealTimers());

  it("answers from the cache at once, without waiting for the server", async () => {
    store.set(`caretook:settings:${USER}`, JSON.stringify(serverSettings("cards")));
    api.get.mockReturnValue(new Promise(() => undefined));
    expect((await loadSettings(request, USER)).timelineView).toBe("cards");
    expect(api.get).toHaveBeenCalledTimes(1);
  });

  it("publishes what a background refresh brings, and caches it", async () => {
    store.set(`caretook:settings:${USER}`, JSON.stringify(serverSettings("rows")));
    let answer!: (value: unknown) => void;
    api.get.mockReturnValue(new Promise((resolve) => (answer = resolve)));
    const heard = vi.fn();
    const stop = subscribeSettings(heard);
    expect((await loadSettings(request, USER)).timelineView).toBe("rows");
    heard.mockClear();
    answer(serverSettings("cards"));
    await vi.waitFor(() => expect(heard).toHaveBeenCalled());
    expect(cached()?.timelineView).toBe("cards");
    stop();
  });

  it("doesn't publish when the server's copy is the same", async () => {
    store.set(`caretook:settings:${USER}`, JSON.stringify(serverSettings("rows")));
    api.get.mockResolvedValue(serverSettings("rows"));
    const settled = () => new Promise((resolve) => setTimeout(resolve, 0));
    await loadSettings(request, USER);
    await settled();
    const heard = vi.fn();
    const stop = subscribeSettings(heard);
    await loadSettings(request, USER);
    await settled();
    expect(api.get).toHaveBeenCalledTimes(2);
    expect(heard).not.toHaveBeenCalled();
    stop();
  });

  it("ignores a lost session in the background: the session check handles it", async () => {
    store.set(`caretook:settings:${USER}`, JSON.stringify(serverSettings("rows")));
    api.get.mockRejectedValue(new ORPCError("UNAUTHORIZED"));
    expect((await loadSettings(request, USER)).timelineView).toBe("rows");
  });

  it("with no cache, gives up after 3 s and uses the defaults", async () => {
    vi.useFakeTimers();
    api.get.mockReturnValue(new Promise(() => undefined));
    let result: { timelineView: string } | undefined;
    void loadSettings(request, USER).then((r) => (result = r));
    await vi.advanceTimersByTimeAsync(2999);
    expect(result).toBeUndefined();
    await vi.advanceTimersByTimeAsync(1);
    expect(result?.timelineView).toBe("rows");
  });

  it("shares one refresh between loaders on the same navigation", async () => {
    store.set(`caretook:settings:${USER}`, JSON.stringify(serverSettings("rows")));
    api.get.mockReturnValue(new Promise(() => undefined));
    await Promise.all([loadSettings(request, USER), loadSettings(request, USER)]);
    expect(api.get).toHaveBeenCalledTimes(1);
  });
});

describe("startSettings, the early fetch (B-958)", () => {
  it("shares its request with a loader that asks while it's in flight", async () => {
    let answer!: (value: unknown) => void;
    api.get.mockReturnValue(new Promise((resolve) => (answer = resolve)));
    startSettings(request, USER);
    const loaded = loadSettings(request, USER);
    answer(serverSettings("cards"));
    expect((await loaded).timelineView).toBe("cards");
    expect(api.get).toHaveBeenCalledTimes(1);
  });

  it("answers a loader from what it brought, without asking again", async () => {
    api.get.mockResolvedValue(serverSettings("cards"));
    startSettings(request, USER);
    await vi.waitFor(() => expect(cached()?.timelineView).toBe("cards"));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect((await loadSettings(request, USER)).timelineView).toBe("cards");
    expect((await loadSettings(request, USER)).timelineView).toBe("cards");
    expect(api.get).toHaveBeenCalledTimes(1);
  });

  it("sends a pending change first, as a loader would", async () => {
    store.set(`caretook:settings-pending:${USER}`, JSON.stringify({ timelineView: "cards" }));
    api.updatePreferences.mockResolvedValue({});
    api.get.mockResolvedValue(serverSettings("cards"));
    startSettings(request, USER);
    expect((await loadSettings(request, USER)).timelineView).toBe("cards");
    expect(api.updatePreferences).toHaveBeenCalledTimes(1);
    expect(api.get).toHaveBeenCalledTimes(1);
    expect(pending()).toBeNull();
  });

  it("does nothing when there's a cache: the loader answers from it", () => {
    store.set(`caretook:settings:${USER}`, JSON.stringify(serverSettings("rows")));
    startSettings(request, USER);
    expect(api.get).not.toHaveBeenCalled();
  });

  it("when it fails offline, the loader asks again", async () => {
    api.get.mockRejectedValueOnce(offline()).mockResolvedValue(serverSettings("cards"));
    startSettings(request, USER);
    await vi.waitFor(() => expect(api.get).toHaveBeenCalledTimes(1));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect((await loadSettings(request, USER)).timelineView).toBe("cards");
    expect(api.get).toHaveBeenCalledTimes(2);
  });

  it("when it's refused, the loader asks again and fails as before", async () => {
    api.get.mockRejectedValue(new ORPCError("INTERNAL_SERVER_ERROR"));
    startSettings(request, USER);
    await vi.waitFor(() => expect(api.get).toHaveBeenCalledTimes(1));
    await new Promise((resolve) => setTimeout(resolve, 0));
    await expect(loadSettings(request, USER)).rejects.toBeInstanceOf(ORPCError);
    expect(api.get).toHaveBeenCalledTimes(2);
  });

  it("a loader asks again once it's no longer recent", async () => {
    vi.useFakeTimers();
    api.get.mockResolvedValue(serverSettings("cards"));
    startSettings(request, USER);
    await vi.advanceTimersByTimeAsync(0);
    expect(cached()?.timelineView).toBe("cards");
    await vi.advanceTimersByTimeAsync(3000);
    await loadSettings(request, USER);
    expect(api.get).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it("is forgotten at sign-out", async () => {
    api.get.mockResolvedValue(serverSettings("cards"));
    startSettings(request, USER);
    await vi.waitFor(() => expect(cached()?.timelineView).toBe("cards"));
    await new Promise((resolve) => setTimeout(resolve, 0));
    forgetSettings();
    expect((await loadSettings(request, USER)).timelineView).toBe("cards");
    expect(api.get).toHaveBeenCalledTimes(2);
  });
});

describe("forgetSettings", () => {
  it("clears cached settings and pending changes", async () => {
    api.updatePreferences.mockRejectedValue(offline());
    await saveSettings(USER, { timelineView: "cards" });
    store.set("other", "kept");
    forgetSettings();
    expect([...store.keys()]).toEqual(["other"]);
  });
});
