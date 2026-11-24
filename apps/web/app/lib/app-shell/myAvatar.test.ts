import { ORPCError } from "@orpc/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { appUrls } from "./appUrls";

const api = vi.hoisted(() => ({ get: vi.fn(), updatePreferences: vi.fn(), setAvatar: vi.fn() }));
vi.mock("../core/rpc", () => ({ rpc: { me: api } }));

const { forgetMyAvatar, myAvatarOverlay, saveMyAvatar, settleMyAvatar } = await import("./myAvatar");
const { forgetSettings, loadSettings, saveSettings } = await import("./me");

const USER = "u1";
const PENDING = `caretook:avatar-pending:${USER}`;
const SETTINGS_PENDING = `caretook:settings-pending:${USER}`;
const JADE = { color: "jade", icon: "bird" } as const;
const CLEARED = { color: null, icon: null };
const request = new Request(`http://localhost${appUrls.timeline("g")}`);
const offline = () => new TypeError("Failed to fetch");
const refused = () => new ORPCError("BAD_REQUEST", { status: 400 });

const store = new Map<string, string>();
vi.stubGlobal(
  "localStorage",
  new Proxy(
    {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    },
    {
      ownKeys: () => [...store.keys()],
      getOwnPropertyDescriptor: (_t, k) =>
        typeof k === "string" && store.has(k)
          ? { enumerable: true, configurable: true, value: store.get(k) }
          : undefined,
    },
  ),
);

const stored = (key: string) => JSON.parse(store.get(key) ?? "null") as unknown;
const echo = (input: unknown) => Promise.resolve({ avatar: input });

beforeEach(() => {
  forgetMyAvatar();
  forgetSettings();
  store.clear();
  for (const fn of Object.values(api)) fn.mockReset();
});

describe("saveMyAvatar", () => {
  it("online, sends the choice and leaves nothing queued", async () => {
    api.setAvatar.mockImplementation(echo);
    expect(await saveMyAvatar(USER, JADE)).toBe("saved");
    expect(api.setAvatar).toHaveBeenCalledWith(JADE);
    expect(stored(PENDING)).toBeNull();
  });

  it("offline, keeps the choice queued", async () => {
    api.setAvatar.mockRejectedValue(offline());
    expect(await saveMyAvatar(USER, JADE)).toBe("pending");
    expect(stored(PENDING)).toEqual(JADE);
  });

  it("keeps the choice queued on a server error or a lost session", async () => {
    api.setAvatar.mockRejectedValueOnce(new ORPCError("INTERNAL_SERVER_ERROR", { status: 500 }));
    expect(await saveMyAvatar(USER, JADE)).toBe("pending");
    api.setAvatar.mockRejectedValueOnce(new ORPCError("UNAUTHORIZED", { status: 401 }));
    expect(await saveMyAvatar(USER, JADE)).toBe("pending");
    expect(stored(PENDING)).toEqual(JADE);
  });

  it("a queued clear is sent as null", async () => {
    api.setAvatar.mockRejectedValueOnce(offline());
    await saveMyAvatar(USER, CLEARED);
    expect(stored(PENDING)).toEqual(CLEARED);
    api.setAvatar.mockImplementation(echo);
    expect(await saveMyAvatar(USER, CLEARED)).toBe("saved");
    expect(api.setAvatar).toHaveBeenLastCalledWith(CLEARED);
    expect(stored(PENDING)).toBeNull();
  });

  it("drops a refused choice and rejects", async () => {
    const error = refused();
    api.setAvatar.mockRejectedValue(error);
    await expect(saveMyAvatar(USER, JADE)).rejects.toBe(error);
    expect(stored(PENDING)).toBeNull();
  });

  it("sends one at a time, ending on the latest choice", async () => {
    let finish!: (value: unknown) => void;
    api.setAvatar.mockReturnValueOnce(new Promise((resolve) => (finish = resolve)));
    api.setAvatar.mockImplementation(echo);
    const first = saveMyAvatar(USER, JADE);
    await vi.waitFor(() => expect(api.setAvatar).toHaveBeenCalledTimes(1));
    const second = saveMyAvatar(USER, CLEARED);
    expect(api.setAvatar).toHaveBeenCalledTimes(1);
    finish({ avatar: JADE });
    await Promise.all([first, second]);
    expect(api.setAvatar.mock.calls.map(([input]) => input as unknown)).toEqual([JADE, CLEARED]);
    expect(stored(PENDING)).toBeNull();
    expect(stored(`caretook:avatar:${USER}`)).toEqual(CLEARED);
  });
});

describe("beside the settings queue", () => {
  const queueBoth = async () => {
    api.setAvatar.mockRejectedValueOnce(offline());
    api.updatePreferences.mockRejectedValueOnce(offline());
    await saveMyAvatar(USER, JADE);
    await saveSettings(USER, { units: { weight: "kg" } });
  };

  it("a queued avatar and a queued units change both reach the server, separately", async () => {
    await queueBoth();
    api.setAvatar.mockImplementation(echo);
    api.updatePreferences.mockResolvedValue({});
    api.get.mockResolvedValue({ units: { weight: "kg" } });
    await saveMyAvatar(USER, JADE);
    await loadSettings(request, USER);
    await vi.waitFor(() => expect(stored(SETTINGS_PENDING)).toBeNull());
    expect(api.setAvatar).toHaveBeenLastCalledWith(JADE);
    expect(api.updatePreferences).toHaveBeenLastCalledWith({ units: { weight: "kg" } });
    expect(stored(PENDING)).toBeNull();
  });

  it("a refused avatar doesn't drop the units change", async () => {
    await queueBoth();
    api.setAvatar.mockRejectedValue(refused());
    await expect(saveMyAvatar(USER, JADE)).rejects.toBeInstanceOf(ORPCError);
    expect(stored(PENDING)).toBeNull();
    expect(stored(SETTINGS_PENDING)).toEqual({ units: { weight: "kg" } });
  });

  it("a refused units change doesn't drop the avatar", async () => {
    await queueBoth();
    api.updatePreferences.mockRejectedValue(refused());
    api.get.mockResolvedValue({});
    await loadSettings(request, USER);
    await vi.waitFor(() => expect(stored(SETTINGS_PENDING)).toBeNull());
    expect(stored(PENDING)).toEqual(JADE);
  });
});

describe("the overlay on your synced row", () => {
  it("holds an accepted choice until the synced row matches it", async () => {
    api.setAvatar.mockImplementation(echo);
    await saveMyAvatar(USER, JADE);
    expect(store.has(PENDING)).toBe(false);
    expect(myAvatarOverlay(USER)).toEqual(JADE);

    settleMyAvatar(USER, CLEARED);
    expect(myAvatarOverlay(USER)).toEqual(JADE);

    settleMyAvatar(USER, JADE);
    expect(myAvatarOverlay(USER)).toBeNull();
  });

  it("holds a cleared choice as a choice, not as nothing to show", async () => {
    api.setAvatar.mockImplementation(echo);
    await saveMyAvatar(USER, CLEARED);
    expect(myAvatarOverlay(USER)).toEqual(CLEARED);
    settleMyAvatar(USER, CLEARED);
    expect(myAvatarOverlay(USER)).toBeNull();
  });

  it("shows a queued choice while offline, and no overlay after a refusal", async () => {
    api.setAvatar.mockRejectedValueOnce(offline());
    await saveMyAvatar(USER, JADE);
    expect(myAvatarOverlay(USER)).toEqual(JADE);
    settleMyAvatar(USER, JADE);
    expect(myAvatarOverlay(USER)).toEqual(JADE);

    forgetMyAvatar();
    api.setAvatar.mockRejectedValueOnce(refused());
    await expect(saveMyAvatar(USER, JADE)).rejects.toBeDefined();
    expect(myAvatarOverlay(USER)).toBeNull();
  });

  it("sign-out forgets it", async () => {
    api.setAvatar.mockImplementation(echo);
    await saveMyAvatar(USER, JADE);
    forgetMyAvatar();
    expect(myAvatarOverlay(USER)).toBeNull();
  });
});

describe("forgetMyAvatar", () => {
  it("forgets the queue and the cache, and a send in flight writes nothing", async () => {
    api.setAvatar.mockRejectedValueOnce(offline());
    await saveMyAvatar(USER, JADE);
    let finish!: (value: unknown) => void;
    api.setAvatar.mockReturnValueOnce(new Promise((resolve) => (finish = resolve)));
    const inFlight = saveMyAvatar(USER, JADE);
    await vi.waitFor(() => expect(api.setAvatar).toHaveBeenCalledTimes(2));
    store.set("other", "kept");
    forgetMyAvatar();
    expect([...store.keys()]).toEqual(["other"]);
    finish({ avatar: JADE });
    await inFlight;
    expect([...store.keys()]).toEqual(["other"]);
  });
});
