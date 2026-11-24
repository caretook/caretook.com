import type { CalendarSettings } from "./calendarSettings";

import { DETAILS_CONSENT_VERSION } from "@caretook/data/schema";
import { ORPCError } from "@orpc/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

// A member's calendar settings on the device (appointments-2): the cache,
// what's pending offline, and sending it later. The API is a stand-in.

const api = vi.hoisted(() => ({ get: vi.fn(), update: vi.fn() }));
vi.mock("../core/rpc", () => ({ rpc: { calendars: { settings: api } } }));

const {
  detailsConsentChange,
  forgetCalendarSettings,
  knownCalendarSettings,
  leftAfterSending,
  loadCalendarSettings,
  saveCalendarSettings,
  withChange,
  withCurrentConsent,
  withoutOutdatedConsent,
} = await import("./calendarSettings");

const USER = "u1";
const GROUP = "g1";
const request = new Request("http://localhost/app/groups/g1/settings/calendar");
const offline = () => new TypeError("Failed to fetch");
const AGREE = { detailsConsent: true, detailsConsentVersion: DETAILS_CONSENT_VERSION };
const PENDING_KEY = `caretook:calendar-pending:${USER}:${GROUP}`;

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
  detailsConsentStale: false,
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

describe("withCurrentConsent", () => {
  const consentAt = "2026-03-02T18:00:00.000Z";

  it("reads a copy cached before the wording changed as out of date", () => {
    const cached = settings({
      detailsConsent: true,
      detailsConsentAt: consentAt,
      detailsConsentVersion: "2020-01-01",
      shareLevel: "details",
    });
    expect(withCurrentConsent(cached)).toMatchObject({
      detailsConsent: false,
      detailsConsentStale: true,
      shareLevel: "generic",
      detailsConsentAt: consentAt,
    });
  });

  it("leaves a current consent and a member who never agreed alone", () => {
    const current = settings({
      detailsConsent: true,
      detailsConsentAt: consentAt,
      detailsConsentVersion: DETAILS_CONSENT_VERSION,
      shareLevel: "details",
    });
    expect(withCurrentConsent(current)).toBe(current);
    const never = settings();
    expect(withCurrentConsent(never)).toBe(never);
  });
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

    const stale = settings({
      detailsConsentAt: "2026-03-02T18:00:00.000Z",
      detailsConsentVersion: "2020-01-01",
      detailsConsentStale: true,
    });
    expect(withChange(stale, { detailsConsent: true })).toMatchObject({
      detailsConsent: true,
      detailsConsentStale: false,
      detailsConsentAt: null,
      shareLevel: "details",
    });
    expect(withChange(stale, { detailsConsent: false })).toMatchObject({
      detailsConsent: false,
      detailsConsentStale: false,
      detailsConsentAt: null,
    });
    expect(withChange(stale, { remindersOn: true }).detailsConsentStale).toBe(true);
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

describe("the consent's version (B-659)", () => {
  it("names the wording on screen when agreeing, and nothing when turning off", () => {
    expect(detailsConsentChange(true)).toEqual(AGREE);
    expect(detailsConsentChange(false)).toEqual({ detailsConsent: false });
  });

  it("counts a pending consent only at the current version", () => {
    expect(withoutOutdatedConsent(AGREE)).toEqual(AGREE);
    expect(withoutOutdatedConsent({ detailsConsent: false })).toEqual({ detailsConsent: false });
    expect(withoutOutdatedConsent({ detailsConsent: true })).toBeNull();
    expect(
      withoutOutdatedConsent({
        detailsConsent: true,
        detailsConsentVersion: "2020-01-01",
        remindersOn: true,
      }),
    ).toEqual({ remindersOn: true });
  });

  it("treats the consent and its version as one answer once sent", () => {
    expect(leftAfterSending(AGREE, AGREE)).toBeNull();
    const newer = { detailsConsent: true, detailsConsentVersion: "2099-01-01" };
    expect(leftAfterSending(newer, AGREE)).toEqual(newer);
  });

  it.each([
    ["saved before this fix", { detailsConsent: true, remindersOn: true }],
    [
      "for an older wording",
      { detailsConsent: true, detailsConsentVersion: "2020-01-01", remindersOn: true },
    ],
  ])("drops a pending consent %s on replay and keeps the rest", async (_name, stored) => {
    store.set(`caretook:calendar:${USER}:${GROUP}`, JSON.stringify(settings()));
    store.set(PENDING_KEY, JSON.stringify(stored));
    expect(knownCalendarSettings(USER, GROUP)).toMatchObject({ detailsConsent: false, remindersOn: true });

    api.update.mockResolvedValueOnce(settings({ remindersOn: true }));
    api.get.mockResolvedValueOnce(settings({ remindersOn: true }));
    expect(await loadCalendarSettings(request, USER, GROUP)).toMatchObject({
      online: true,
      settings: { detailsConsent: false, remindersOn: true },
    });
    expect(api.update.mock.calls).toEqual([[{ groupId: GROUP, remindersOn: true }]]);
    expect(store.has(PENDING_KEY)).toBe(false);
  });

  it("sends nothing when the outdated consent was all that was pending", async () => {
    store.set(PENDING_KEY, JSON.stringify({ detailsConsent: true, detailsConsentVersion: "2020-01-01" }));
    api.get.mockResolvedValueOnce(settings());
    await loadCalendarSettings(request, USER, GROUP);
    expect(api.update).not.toHaveBeenCalled();
    expect(store.has(PENDING_KEY)).toBe(false);
  });

  it("drops the consent when the server has moved past this app's wording, and still sends the rest", async () => {
    store.set(PENDING_KEY, JSON.stringify({ ...AGREE, remindersOn: true }));
    api.update.mockRejectedValueOnce(
      new ORPCError("CONFLICT", {
        message: "The wording changed",
        data: { code: "calendarSettingService:consentOutdated" },
      }),
    );
    api.update.mockResolvedValueOnce(settings({ remindersOn: true }));
    api.get.mockResolvedValueOnce(settings({ remindersOn: true }));
    expect(await loadCalendarSettings(request, USER, GROUP)).toMatchObject({
      settings: { detailsConsent: false, remindersOn: true },
    });
    expect(api.update).toHaveBeenLastCalledWith({ groupId: GROUP, remindersOn: true });
    expect(store.has(PENDING_KEY)).toBe(false);
  });

  it("turning off over a pending agreement leaves no version behind", async () => {
    api.update.mockRejectedValue(offline());
    await saveCalendarSettings(USER, GROUP, AGREE);
    await saveCalendarSettings(USER, GROUP, { detailsConsent: false });
    expect(JSON.parse(store.get(PENDING_KEY)!)).toEqual({ detailsConsent: false });
  });
});

describe("saving and loading", () => {
  it("saves at once online, and caches the server's copy", async () => {
    api.update.mockResolvedValue(settings({ detailsConsent: true, shareLevel: "details" }));
    expect(await saveCalendarSettings(USER, GROUP, AGREE)).toBe("saved");
    expect(api.update).toHaveBeenCalledWith({ groupId: GROUP, ...AGREE });
    expect(knownCalendarSettings(USER, GROUP)?.detailsConsent).toBe(true);
  });

  it("keeps an offline change pending, shows it, and sends it on the next load", async () => {
    api.get.mockResolvedValueOnce(settings());
    await loadCalendarSettings(request, USER, GROUP);
    api.update.mockRejectedValueOnce(offline());
    expect(await saveCalendarSettings(USER, GROUP, AGREE)).toBe("pending");
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
    expect(api.update).toHaveBeenLastCalledWith({ groupId: GROUP, ...AGREE });

    // Nothing left to send.
    api.get.mockResolvedValueOnce(settings({ detailsConsent: true }));
    await loadCalendarSettings(request, USER, GROUP);
    expect(api.update).toHaveBeenCalledTimes(3);
  });

  it("drops a pending change the server refuses, and uses its copy", async () => {
    api.update.mockRejectedValueOnce(offline());
    await saveCalendarSettings(USER, GROUP, AGREE);
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
    await expect(saveCalendarSettings(USER, GROUP, AGREE)).rejects.toBeInstanceOf(ORPCError);
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
