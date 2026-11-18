import { describe, expect, it } from "vitest";
import { newSheetGuard, onlySheetChanged } from "./sheetGuard";

const G = "0b6f3c1e-5d1a-4c2e-9a77-3f1d2b8c0001";
const TIMELINE = `/app/groups/${G}/timeline`;
const writer = { groupId: G, canWrite: true, search: "" };

describe("newSheetGuard", () => {
  it("opens a symptom or a vital for a writer", () => {
    expect(newSheetGuard({ ...writer, kind: "symptom" })).toEqual({
      sheet: { kind: "symptom", vitalType: null },
    });
    expect(newSheetGuard({ ...writer, kind: "vital" })).toEqual({
      sheet: { kind: "vital", vitalType: null },
    });
  });

  it("starts a vital with a known `type`, and ignores an unknown one", () => {
    expect(newSheetGuard({ ...writer, kind: "vital", search: "?type=heartRate" })).toEqual({
      sheet: { kind: "vital", vitalType: "heartRate" },
    });
    expect(newSheetGuard({ ...writer, kind: "vital", search: "?type=bogus" })).toEqual({
      sheet: { kind: "vital", vitalType: null },
    });
    expect(newSheetGuard({ ...writer, kind: "symptom", search: "?type=heartRate" })).toEqual({
      sheet: { kind: "symptom", vitalType: null },
    });
  });

  it("sends notes, events and unknown kinds to the timeline, keeping its filters", () => {
    for (const kind of ["note", "event", "anything", undefined]) {
      expect(newSheetGuard({ ...writer, kind, search: "?kind=symptom&type=spo2" })).toEqual({
        redirect: `${TIMELINE}?kind=symptom`,
      });
    }
  });

  it("sends a viewer to the timeline", () => {
    expect(newSheetGuard({ ...writer, canWrite: false, kind: "symptom", search: "?kind=vital" })).toEqual({
      redirect: `${TIMELINE}?kind=vital`,
    });
    expect(newSheetGuard({ ...writer, canWrite: false, kind: "vital", search: "?type=spo2" })).toEqual({
      redirect: TIMELINE,
    });
  });
});

describe("onlySheetChanged", () => {
  const url = (path: string) => new URL(path, "http://localhost");

  it("is true for opening or closing a sheet with the same filters", () => {
    expect(onlySheetChanged(G, url(`${TIMELINE}?kind=vital`), url(`${TIMELINE}/new/vital?kind=vital`))).toBe(
      true,
    );
    expect(onlySheetChanged(G, url(`${TIMELINE}/new/vital?type=spo2`), url(`${TIMELINE}`))).toBe(true);
  });

  it("is false when the filters change", () => {
    expect(onlySheetChanged(G, url(`${TIMELINE}`), url(`${TIMELINE}/new/symptom?kind=symptom`))).toBe(false);
  });

  it("is false for the same path, or a path off the timeline", () => {
    expect(onlySheetChanged(G, url(TIMELINE), url(TIMELINE))).toBe(false);
    expect(onlySheetChanged(G, url(TIMELINE), url(`/app/groups/${G}/entries/e1`))).toBe(false);
    expect(onlySheetChanged(G, url(TIMELINE), url(`/app/groups/other/timeline/new/symptom`))).toBe(false);
    expect(onlySheetChanged(G, url(TIMELINE), url(`${TIMELINE}-x/new/symptom`))).toBe(false);
  });
});
