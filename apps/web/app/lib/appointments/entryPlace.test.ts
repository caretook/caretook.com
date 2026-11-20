import { describe, expect, it } from "vitest";
import { placeMapAction, shownPlace } from "./entryPlace";

const clinic = { name: "Dr. Alvarez", address: "12 Elm St\nSuite 4\nSpringfield" };
const pharmacy = { name: "Corner Pharmacy", address: "5 Main St" };

describe("shownPlace", () => {
  it("shows a typed place, whatever is linked", () => {
    expect(shownPlace("Lab, 2nd floor", [clinic])).toEqual({ text: "Lab, 2nd floor", from: null });
  });

  it("defaults to the first linked provider's address, on one line", () => {
    expect(shownPlace(null, [clinic, pharmacy])).toEqual({
      text: "12 Elm St, Suite 4, Springfield",
      from: "Dr. Alvarez",
    });
    expect(shownPlace("  ", [clinic])?.from).toBe("Dr. Alvarez");
  });

  it("skips removed providers and those without an address", () => {
    expect(shownPlace(null, [{ ...clinic, deletedAt: "2026-11-01T00:00:00Z" }, pharmacy])).toEqual({
      text: "5 Main St",
      from: "Corner Pharmacy",
    });
    expect(shownPlace(null, [{ name: "Aide", address: " \n " }, pharmacy])?.from).toBe("Corner Pharmacy");
  });

  it("is null with neither", () => {
    expect(shownPlace(null, [])).toBeNull();
    expect(shownPlace("", [{ name: "Aide", address: null }])).toBeNull();
  });
});

describe("placeMapAction", () => {
  it("searches maps for whichever place shows", () => {
    const typed = placeMapAction(shownPlace("Lab, 2nd floor", [clinic]));
    expect(typed).toEqual({
      kind: "map",
      href: "https://www.google.com/maps/search/?api=1&query=Lab%2C%202nd%20floor",
      label: "Open Lab, 2nd floor in maps",
      value: "Lab, 2nd floor",
    });
    expect(placeMapAction(shownPlace(null, [clinic]))?.href).toContain("12%20Elm%20St%2C%20Suite%204");
  });

  it("is null without a place", () => {
    expect(placeMapAction(null)).toBeNull();
  });
});
