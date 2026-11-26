import { describe, expect, it } from "vitest";
import {
  DEFAULT_PROVIDERS_VIEW,
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
