import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { endSession, requireSession } from "./session";

// The session check's two new duties (sync-safety slice 4, B-290), with the
// server and the local database faked:
// - a sign-out left pending offline is finished first, and the answer is
//   signed out without asking who is signed in; the marker clears only once
//   the server has the sign-out;
// - a session the server ended keeps the local copy for its owner when
//   changes wait to upload, else wipes it.

const auth = vi.hoisted(() => ({
  getSession: vi.fn(),
  signOut: vi.fn(),
}));
const sync = vi.hoisted(() => ({
  closeSync: vi.fn((_options?: { keep?: boolean }) => Promise.resolve()),
  countWaiting: vi.fn(() => Promise.resolve(0)),
  openSync: vi.fn((userId: string) => Promise.resolve({ userId })),
}));
const forget = vi.hoisted(() => vi.fn((_options?: { keepPending?: boolean }) => undefined));

vi.mock("./auth-client", () => ({ authClient: auth }));
vi.mock("../sync", () => sync);
vi.mock("./forgetUserData", () => ({ forgetUserData: forget }));

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
      get length() {
        return Object.keys(items).length;
      },
      key: (i: number) => Object.keys(items)[i] ?? null,
    },
    {
      ownKeys: () => Object.keys(items),
      getOwnPropertyDescriptor: () => ({ enumerable: true, configurable: true }),
    },
  );
};

const PENDING = "caretook:sign-out-pending";
const USER = { id: "u1", name: "Fictional Caretaker", email: "caretaker@example.com" };
const request = () => new Request("https://caretook.invalid/app/groups/g1/timeline");

/** `requireSession`'s redirect, as the location it sends to. */
const redirectOf = async (promise: Promise<unknown>) => {
  const thrown = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  return thrown instanceof Response
    ? new URL(thrown.headers.get("Location")!, "https://x.invalid").pathname
    : thrown;
};

beforeEach(() => {
  vi.stubGlobal("localStorage", memoryStorage());
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  for (const f of [auth.getSession, auth.signOut, sync.closeSync, sync.countWaiting, sync.openSync, forget])
    f.mockClear();
  auth.getSession.mockResolvedValue({ data: null, error: null });
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("requireSession with a sign-out pending", () => {
  it("signs out on the server first, answers signed out without asking, and clears the marker", async () => {
    localStorage.setItem(PENDING, "1");
    auth.signOut.mockResolvedValue({ data: { success: true }, error: null });
    expect(await redirectOf(requireSession(request()))).toBe("/sign-in");
    expect(auth.signOut).toHaveBeenCalledOnce();
    expect(auth.getSession).not.toHaveBeenCalled();
    expect(localStorage.getItem(PENDING)).toBeNull();
  });

  it("keeps the marker while the server can't be reached, still signed out", async () => {
    localStorage.setItem(PENDING, "1");
    auth.signOut.mockRejectedValue(new TypeError("Failed to fetch"));
    expect(await redirectOf(requireSession(request()))).toBe("/sign-in");
    expect(auth.getSession).not.toHaveBeenCalled();
    expect(localStorage.getItem(PENDING)).not.toBeNull();
  });

  it("keeps the marker on a server error", async () => {
    localStorage.setItem(PENDING, "1");
    auth.signOut.mockResolvedValue({ data: null, error: { status: 503 } });
    expect(await redirectOf(requireSession(request()))).toBe("/sign-in");
    expect(localStorage.getItem(PENDING)).not.toBeNull();
  });

  it("asks the server as usual with no marker", async () => {
    auth.getSession.mockResolvedValue({ data: { user: { ...USER, emailVerified: true } }, error: null });
    const session = await requireSession(request());
    expect(auth.signOut).not.toHaveBeenCalled();
    expect(session.user.id).toBe("u1");
  });
});

describe("endSession: the server ended the session", () => {
  beforeEach(() => localStorage.setItem("caretook:session-user", JSON.stringify(USER)));

  it("keeps the copy for its owner when changes wait to upload", async () => {
    sync.countWaiting.mockResolvedValue(2);
    expect(await endSession()).toBe("keep");
    expect(sync.closeSync).toHaveBeenCalledWith({ keep: true });
    expect(forget).toHaveBeenCalledWith({ keepPending: true });
    expect(localStorage.getItem("caretook:session-user")).toBeNull();
  });

  it("wipes it with nothing waiting", async () => {
    sync.countWaiting.mockResolvedValue(0);
    expect(await endSession()).toBe("wipe");
    expect(sync.closeSync).toHaveBeenCalledWith();
    expect(forget).toHaveBeenCalledWith();
  });

  it("is what a signed-out answer does for a cached user", async () => {
    sync.countWaiting.mockResolvedValue(1);
    expect(await redirectOf(requireSession(request()))).toBe("/sign-in");
    expect(sync.closeSync).toHaveBeenCalledWith({ keep: true });
  });
});
