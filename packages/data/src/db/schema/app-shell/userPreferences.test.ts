import { describe, expect, it } from "vitest";
import {
  DEFAULT_PROVIDERS_VIEW,
  MAX_GROUP_SETUP,
  mergeGroupSetup,
  resolveGroupSetup,
  DEFAULT_TIMELINE_VIEW,
  resolveProvidersView,
  resolveTimelineView,
  userPreferencesZSchema,
} from "./userPreferences";

describe("providersView (B-909)", () => {
  it("parses either layout and refuses anything else", () => {
    expect(userPreferencesZSchema.parse({ providersView: "cards" })).toEqual({ providersView: "cards" });
    expect(userPreferencesZSchema.parse({ providersView: "rows" })).toEqual({ providersView: "rows" });
    expect(userPreferencesZSchema.safeParse({ providersView: "grid" }).success).toBe(false);
  });

  it("resolves to Condensed when unset", () => {
    expect(DEFAULT_PROVIDERS_VIEW).toBe("rows");
    expect(resolveProvidersView(null)).toBe("rows");
    expect(resolveProvidersView({})).toBe("rows");
    expect(resolveProvidersView({ timelineView: "cards" })).toBe("rows");
    expect(resolveProvidersView({ providersView: "cards" })).toBe("cards");
  });

  it("leaves the timeline's layout alone", () => {
    expect(resolveTimelineView({ providersView: "cards" })).toBe(DEFAULT_TIMELINE_VIEW);
    expect(resolveTimelineView({ timelineView: "cards", providersView: "rows" })).toBe("cards");
  });
});

describe("groupSetup", () => {
  const A = "0b6f3c1e-5d1a-4c2e-9a77-3f1d2b8c0a01";
  const B = "0b6f3c1e-5d1a-4c2e-9a77-3f1d2b8c0a02";

  it("keeps both devices' groups and retirements, and never drops opened", () => {
    const phone = { [A]: { opened: true as const, retired: ["help" as const] } };
    const laptop = { [A]: { retired: ["entry" as const] }, [B]: { opened: true as const } };
    expect(mergeGroupSetup(phone, laptop)).toEqual({
      [A]: { opened: true, retired: ["help", "entry"] },
      [B]: { opened: true },
    });
    expect(mergeGroupSetup(laptop, phone)).toEqual({
      [A]: { opened: true, retired: ["entry", "help"] },
      [B]: { opened: true },
    });
    expect(mergeGroupSetup(phone, { [A]: {} })).toEqual(phone);
    expect(mergeGroupSetup(phone, { [A]: { retired: ["help"] } })).toEqual(phone);
    expect(mergeGroupSetup(null, undefined)).toEqual({});
  });

  it("holds the cap, keeping the newest groups", () => {
    const id = (n: number) => `0b6f3c1e-5d1a-4c2e-9a77-${n.toString().padStart(12, "0")}`;
    const full = Object.fromEntries(
      Array.from({ length: MAX_GROUP_SETUP }, (_, n) => [id(n), { opened: true as const }]),
    );
    const merged = mergeGroupSetup(full, { [id(MAX_GROUP_SETUP)]: { opened: true } });
    expect(Object.keys(merged)).toHaveLength(MAX_GROUP_SETUP);
    expect(merged[id(0)]).toBeUndefined();
    expect(merged[id(MAX_GROUP_SETUP)]).toEqual({ opened: true });
    expect(userPreferencesZSchema.safeParse({ groupSetup: merged }).success).toBe(true);
    expect(userPreferencesZSchema.safeParse({ groupSetup: { ...full, [id(999_999)]: {} } }).success).toBe(
      false,
    );
  });

  it("parses a record and refuses an unknown nudge, a key that isn't a group id, or another field", () => {
    const setup = { [A]: { opened: true, retired: ["help", "entry"] } };
    expect(userPreferencesZSchema.parse({ groupSetup: setup })).toEqual({ groupSetup: setup });
    for (const groupSetup of [
      { [A]: { retired: ["tour"] } },
      { "not-a-group": { opened: true } },
      { [A]: { opened: false } },
      { [A]: { dismissed: true } },
    ])
      expect(userPreferencesZSchema.safeParse({ groupSetup }).success).toBe(false);
  });

  it("resolves to no record when unset", () => {
    expect(resolveGroupSetup(null)).toEqual({});
    expect(resolveGroupSetup({ groupSetup: { [B]: { opened: true } } })).toEqual({ [B]: { opened: true } });
  });
});
