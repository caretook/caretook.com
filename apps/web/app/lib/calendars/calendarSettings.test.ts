import type { CalendarSettings } from "./calendarSettings";

import { ORPCError } from "@orpc/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

// A member's calendar settings on the device (appointments-2): the cache,
// what's pending offline, and sending it later. The API is a stand-in.

const api = vi.hoisted(() => ({ get: vi.fn(), update: vi.fn() }));
vi.mock("../core/rpc", () => ({ rpc: { calendars: { settings: api } } }));

const {
  forgetCalendarSettings,
  knownCalendarSettings,
  leftAfterSending,
  loadCalendarSettings,
  saveCalendarSettings,
  withChange,
} = await import("./calendarSettings");

const USER = "u1";
const GROUP = "g1";
const request = new Request("http://localhost/app/groups/g1/settings/calendar");
const offline = () => new TypeError("Failed to fetch");

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

const settings = (v: Partial<CalendarSettings> = {}): CalendarSettings => ({
  groupId: GROUP,
  role: "caretaker",
  remindersOn: false,
  reminderLeads: ["eveningBefore", 60],
  detailsConsent: false,
  detailsConsentAt: null,
  detailsConsentVersion: null,
  groupAllowsDetails: true,
  shareLevel: "generic",
  feed: { active: false, rotatedAt: null },
  ...v,
});

beforeEach(() => {
  forgetCalendarSettings();
  store.clear();
  api.get.mockReset();
  api.update.mockReset();
});

describe("withChange", () => {
  it("puts a change on top, the share level worked out again", () => {
    expect(withChange(settings(), { detailsConsent: true, remindersOn: true })).toMatchObject({
      detailsConsent: true,
      remindersOn: true,
      shareLevel: "details",
    });
    expect(withChange(settings({ groupAllowsDetails: false }), { detailsConsent: true }).shareLevel).toBe(
      "generic",
    );
    const agreed = settings({ detailsConsent: true, detailsConsentAt: "2026-11-18T18:00:00.000Z" });
    expect(withChange(agreed, { detailsConsent: true }).detailsConsentAt).toBe(agreed.detailsConsentAt);
    expect(withChange(agreed, { detailsConsent: false }).detailsConsentAt).toBeNull();
  });
});

describe("leftAfterSending", () => {
  it("keeps only what changed again since it was sent", () => {
    expect(leftAfterSending({ detailsConsent: true }, { detailsConsent: true })).toBeNull();
    expect(leftAfterSending({ detailsConsent: false, remindersOn: true }, { detailsConsent: true })).toEqual({
      detailsConsent: false,
      remindersOn: true,
    });
    expect(leftAfterSending({ reminderLeads: [60] }, { reminderLeads: [60] })).toBeNull();
  });
});

describe("saving and loading", () => {
  it("saves at once online, and caches the server's copy", async () => {
    api.update.mockResolvedValue(settings({ detailsConsent: true, shareLevel: "details" }));
    expect(await saveCalendarSettings(USER, GROUP, { detailsConsent: true })).toBe("saved");
    expect(api.update).toHaveBeenCalledWith({ groupId: GROUP, detailsConsent: true });
    expect(knownCalendarSettings(USER, GROUP)?.detailsConsent).toBe(true);
  });

  it("keeps an offline change pending, shows it, and sends it on the next load", async () => {
    api.get.mockResolvedValueOnce(settings());
    await loadCalendarSettings(request, USER, GROUP);
    api.update.mockRejectedValueOnce(offline());
    expect(await saveCalendarSettings(USER, GROUP, { detailsConsent: true })).toBe("pending");
    expect(knownCalendarSettings(USER, GROUP)?.detailsConsent).toBe(true);

    // Still offline: the device's copy, with the change.
    api.update.mockRejectedValueOnce(offline());
    expect(await loadCalendarSettings(request, USER, GROUP)).toMatchObject({
      online: false,
      settings: { detailsConsent: true },
    });

    // Back online: sent, then read.
    api.update.mockResolvedValueOnce(settings({ detailsConsent: true }));
    api.get.mockResolvedValueOnce(
      settings({ detailsConsent: true, detailsConsentAt: "2026-11-18T18:00:00.000Z" }),
    );
    expect(await loadCalendarSettings(request, USER, GROUP)).toMatchObject({
      online: true,
      settings: { detailsConsent: true, detailsConsentAt: "2026-11-18T18:00:00.000Z" },
    });
    expect(api.update).toHaveBeenLastCalledWith({ groupId: GROUP, detailsConsent: true });

    // Nothing left to send.
    api.get.mockResolvedValueOnce(settings({ detailsConsent: true }));
    await loadCalendarSettings(request, USER, GROUP);
    expect(api.update).toHaveBeenCalledTimes(3);
  });

  it("drops a pending change the server refuses, and uses its copy", async () => {
    api.update.mockRejectedValueOnce(offline());
    await saveCalendarSettings(USER, GROUP, { detailsConsent: true });
    api.update.mockRejectedValueOnce(
      new ORPCError("FORBIDDEN", { message: "Your group's owners keep details private" }),
    );
    api.get.mockResolvedValueOnce(settings({ groupAllowsDetails: false }));
    expect(await loadCalendarSettings(request, USER, GROUP)).toMatchObject({
      online: true,
      settings: { detailsConsent: false, groupAllowsDetails: false },
    });
    api.get.mockResolvedValueOnce(settings());
    await loadCalendarSettings(request, USER, GROUP);
    expect(api.update).toHaveBeenCalledTimes(2);
  });

  it("rejects a refused save and forgets it", async () => {
    api.get.mockResolvedValueOnce(settings());
    await loadCalendarSettings(request, USER, GROUP);
    api.update.mockRejectedValueOnce(new ORPCError("FORBIDDEN", { message: "No" }));
    await expect(saveCalendarSettings(USER, GROUP, { detailsConsent: true })).rejects.toBeInstanceOf(
      ORPCError,
    );
    expect(knownCalendarSettings(USER, GROUP)?.detailsConsent).toBe(false);
  });

  it("knows nothing offline without a cached copy", async () => {
    api.get.mockRejectedValueOnce(offline());
    expect(await loadCalendarSettings(request, USER, GROUP)).toEqual({ online: false, settings: null });
  });

  it("forgets every copy and pending change at sign-out", async () => {
    api.get.mockResolvedValueOnce(settings());
    await loadCalendarSettings(request, USER, GROUP);
    api.update.mockRejectedValueOnce(offline());
    await saveCalendarSettings(USER, GROUP, { remindersOn: true });
    store.set("caretook:theme", "dark");
    forgetCalendarSettings();
    expect([...store.keys()]).toEqual(["caretook:theme"]);
    expect(knownCalendarSettings(USER, GROUP)).toBeNull();
  });
});
