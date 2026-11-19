import { describe, expect, it } from "vitest";
import {
  newPeriodGuard,
  onlyPeriodSheetChanged,
  openedFromApp,
  parsePeriodPrefill,
  PERIOD_SHEET_STATE,
} from "./periodSheets";

const P = "0b6f3c1e-5d1a-4c2e-9a77-3f1d2b8e1007";
const url = (path: string) => new URL(`http://x${path}`);

describe("period sheets", () => {
  it("opens the add sheet for writers and sends viewers to the periods page", () => {
    expect(newPeriodGuard({ groupId: "g", canWrite: true })).toEqual({ sheet: true });
    expect(newPeriodGuard({ groupId: "g", canWrite: false })).toEqual({ redirect: "/app/groups/g/periods" });
  });

  it("knows a sheet opened by the app's own links", () => {
    expect(openedFromApp(PERIOD_SHEET_STATE)).toBe(true);
    expect(openedFromApp(null)).toBe(false);
    expect(openedFromApp({ medicationSheet: true })).toBe(false);
  });

  it("reads the prefills, dropping what's malformed", () => {
    expect(parsePeriodPrefill(`?type=hospital&startedAt=2026-11-12T22:20:00Z&dateOnly=1&place=${P}`)).toEqual(
      { type: "hospital", startedAt: "2026-11-12T22:20:00.000Z", dateOnly: true, placeProviderId: P },
    );
    expect(parsePeriodPrefill("?type=spa&startedAt=soon&dateOnly=yes&place=nope")).toEqual({
      type: null,
      startedAt: null,
      dateOnly: false,
      placeProviderId: null,
    });
    expect(parsePeriodPrefill("")).toEqual({
      type: null,
      startedAt: null,
      dateOnly: false,
      placeProviderId: null,
    });
  });

  it("keeps the periods page's data when only a sheet opens or closes", () => {
    expect(onlyPeriodSheetChanged("g", url("/app/groups/g/periods"), url("/app/groups/g/periods/new"))).toBe(
      true,
    );
    expect(onlyPeriodSheetChanged("g", url("/app/groups/g/periods/new"), url("/app/groups/g/periods"))).toBe(
      true,
    );
    expect(
      onlyPeriodSheetChanged("g", url("/app/groups/g/periods"), url("/app/groups/g/periods/p1/edit")),
    ).toBe(true);
    expect(onlyPeriodSheetChanged("g", url("/app/groups/g/periods"), url("/app/groups/g/periods/p1"))).toBe(
      false,
    );
    expect(onlyPeriodSheetChanged("g", url("/app/groups/g/periods"), url("/app/groups/g/periods"))).toBe(
      false,
    );
  });
});
