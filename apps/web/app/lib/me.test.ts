import { ORPCError } from "@orpc/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ get: vi.fn(), updatePreferences: vi.fn() }));
vi.mock("./rpc", () => ({ rpc: { me: api } }));

const { forgetSettings, loadSettings, saveSettings } = await import("./me");

const USER = "u1";
const request = new Request("http://localhost/app/groups/g/timeline");
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
    expect(api.updatePreferences).toHaveBeenLastCalledWith({ timelineView: "cards" });
    expect(api.updatePreferences.mock.invocationCallOrder[1]).toBeLessThan(
      api.get.mock.invocationCallOrder[0] ?? 0,
    );
    expect(pending()).toBeNull();
  });

  it("drops a pending change the server refuses, and uses the server's copy", async () => {
    store.set(`caretook:settings-pending:${USER}`, JSON.stringify({ timelineView: "grid" }));
    api.updatePreferences.mockRejectedValue(new ORPCError("BAD_REQUEST"));
    api.get.mockResolvedValue(serverSettings("rows"));
    expect((await loadSettings(request, USER)).timelineView).toBe("rows");
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

describe("forgetSettings", () => {
  it("clears cached settings and pending changes", async () => {
    api.updatePreferences.mockRejectedValue(offline());
    await saveSettings(USER, { timelineView: "cards" });
    store.set("other", "kept");
    forgetSettings();
    expect([...store.keys()]).toEqual(["other"]);
  });
});
