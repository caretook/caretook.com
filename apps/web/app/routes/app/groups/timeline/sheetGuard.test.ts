import { describe, expect, it } from "vitest";
import { editSheetGuard, newSheetGuard, onlySheetChanged } from "./sheetGuard";

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

describe("editSheetGuard", () => {
  const symptom = { id: "e1", groupId: G, kind: "symptom" as const, deletedAt: null };
  const edit = (entry: Parameters<typeof editSheetGuard>[0]["entry"], canWrite = true) =>
    editSheetGuard({ groupId: G, entry, search: "?kind=symptom&type=spo2", canWrite });

  it("opens a writer's symptom or vital", () => {
    expect(edit(symptom)).toEqual({ sheet: { entry: symptom } });
    const vital = { ...symptom, kind: "vital" as const };
    expect(edit(vital)).toEqual({ sheet: { entry: vital } });
  });

  it("sends a note or event to its page, for viewers too", () => {
    for (const kind of ["note", "event"] as const) {
      expect(edit({ ...symptom, kind })).toEqual({ redirect: `/app/groups/${G}/entries/e1` });
      expect(edit({ ...symptom, kind }, false)).toEqual({ redirect: `/app/groups/${G}/entries/e1` });
    }
  });

  it("sends a missing, deleted or other group's entry to the timeline, keeping its filters", () => {
    const timeline = { redirect: `${TIMELINE}?kind=symptom` };
    expect(edit(null)).toEqual(timeline);
    expect(edit({ ...symptom, deletedAt: "2026-11-17T21:45:25.229Z" })).toEqual(timeline);
    expect(edit({ ...symptom, groupId: "other" })).toEqual(timeline);
    expect(edit({ ...symptom, kind: "note", groupId: "other" })).toEqual(timeline);
  });

  it("sends a viewer to the timeline", () => {
    expect(edit(symptom, false)).toEqual({ redirect: `${TIMELINE}?kind=symptom` });
  });
});

describe("onlySheetChanged", () => {
  const url = (path: string) => new URL(path, "http://localhost");

  it("is true for opening or closing a sheet with the same filters", () => {
    expect(onlySheetChanged(G, url(`${TIMELINE}?kind=vital`), url(`${TIMELINE}/new/vital?kind=vital`))).toBe(
      true,
    );
    expect(onlySheetChanged(G, url(`${TIMELINE}/new/vital?type=spo2`), url(`${TIMELINE}`))).toBe(true);
    expect(onlySheetChanged(G, url(`${TIMELINE}?kind=vital`), url(`${TIMELINE}/e1/edit?kind=vital`))).toBe(
      true,
    );
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
