import { afterEach, describe, expect, it } from "vitest";
import {
  closeQuickEntry,
  offerQuickEntry,
  openQuickEntry,
  quickEntryIsOffered,
  quickEntryIsOpen,
} from "./quickEntryOpen";

afterEach(() => closeQuickEntry());

describe("quick entry's open state", () => {
  it("opens and closes", () => {
    expect(quickEntryIsOpen()).toBe(false);
    openQuickEntry();
    expect(quickEntryIsOpen()).toBe(true);
    openQuickEntry();
    expect(quickEntryIsOpen()).toBe(true);
    closeQuickEntry();
    expect(quickEntryIsOpen()).toBe(false);
  });

  it("holds the frame's offer until it's withdrawn", () => {
    const withdraw = offerQuickEntry(true);
    expect(quickEntryIsOffered()).toBe(true);
    withdraw();
    expect(quickEntryIsOffered()).toBe(false);
    offerQuickEntry(false)();
    expect(quickEntryIsOffered()).toBe(false);
  });
});
