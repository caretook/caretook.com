import { describe, expect, it } from "vitest";
import { openedOverProviders, PROVIDER_SHEET_STATE } from "./providerSheetLink";

describe("openedOverProviders", () => {
  it("is true only for a provider sheet link's state", () => {
    expect(openedOverProviders(PROVIDER_SHEET_STATE)).toBe(true);
    expect(openedOverProviders(null)).toBe(false);
    expect(openedOverProviders(undefined)).toBe(false);
    expect(openedOverProviders({ newGroupFromApp: true })).toBe(false);
  });
});
