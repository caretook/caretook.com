import { describe, expect, it } from "vitest";
import { appUrls } from "../app-shell/appUrls";
import { startAtFrom, withoutSheetParams } from "./urls";
import { NEW_ENTRY } from "../live-notes/liveEntry";

const G = "0b6f3c1e-5d1a-4c2e-9a77-3f1d2b8c0001";

describe("timelineUrls", () => {
  it("carries the timeline's search through, in any form", () => {
    expect(appUrls.timeline("g", "?kind=vital")).toBe("/app/groups/g/timeline?kind=vital");
    expect(appUrls.timeline("g", "kind=vital&author=u")).toBe("/app/groups/g/timeline?kind=vital&author=u");
    expect(appUrls.timeline("g", new URLSearchParams({ kind: "note" }))).toBe(
      "/app/groups/g/timeline?kind=note",
    );
    expect(appUrls.timeline("g", { kind: "symptom", author: null })).toBe(
      "/app/groups/g/timeline?kind=symptom",
    );
    expect(appUrls.timeline("g", "")).toBe("/app/groups/g/timeline");
    expect(appUrls.timeline("g", "?")).toBe("/app/groups/g/timeline");
  });

  it("builds the add sheet's path, carrying the timeline's filters", () => {
    expect(appUrls.newSheet(G, "symptom")).toBe(`/app/groups/${G}/timeline/new/symptom`);
    expect(appUrls.newSheet(G, "vital")).toBe(`/app/groups/${G}/timeline/new/vital`);
    expect(appUrls.newSheet("g", "vital", { type: "heartRate" })).toBe(
      "/app/groups/g/timeline/new/vital?type=heartRate",
    );
    expect(appUrls.newSheet("g", "symptom", { search: "?kind=vital&author=u" })).toBe(
      "/app/groups/g/timeline/new/symptom?kind=vital&author=u",
    );
    expect(appUrls.newSheet("g", "vital", { type: "spo2", search: { kind: "symptom" } })).toBe(
      "/app/groups/g/timeline/new/vital?kind=symptom&type=spo2",
    );
  });

  it("drops the add sheet's unknown or misplaced values", () => {
    // A type from an earlier sheet is replaced, not repeated.
    expect(appUrls.newSheet("g", "vital", { type: "weight", search: "?type=spo2&kind=note" })).toBe(
      "/app/groups/g/timeline/new/vital?kind=note&type=weight",
    );
    expect(appUrls.newSheet("g", "symptom", { search: "?type=spo2" })).toBe(
      "/app/groups/g/timeline/new/symptom",
    );
    // @ts-expect-error: only vital types.
    expect(appUrls.newSheet("g", "vital", { type: "bogus" })).toBe("/app/groups/g/timeline/new/vital");
    expect(appUrls.newSheet("g", "symptom", { type: "spo2" })).toBe("/app/groups/g/timeline/new/symptom");
    // @ts-expect-error: notes and events have a page (`newEntry`), not a sheet.
    expect(appUrls.newSheet("g", "note", { search: "?kind=note" })).toBe("/app/groups/g/timeline?kind=note");
  });

  it("builds the edit sheet's path, carrying the timeline's filters", () => {
    expect(appUrls.editSheet(G, "e1")).toBe(`/app/groups/${G}/timeline/e1/edit`);
    expect(appUrls.editSheet("g", "e 1/x", { search: "?kind=vital&author=u&type=spo2" })).toBe(
      "/app/groups/g/timeline/e%201%2Fx/edit?kind=vital&author=u",
    );
    expect(appUrls.editSheet("g", "e1", { search: { kind: "symptom", author: "" } })).toBe(
      "/app/groups/g/timeline/e1/edit?kind=symptom",
    );
  });
});

describe("appUrls.newDose", () => {
  const M = "11111111-2222-4333-8444-555555555555";
  it("is the Dose sheet over the timeline, carrying its filters", () => {
    expect(appUrls.newDose(G)).toBe(`/app/groups/${G}/timeline/new/dose`);
    expect(appUrls.newDose(G, { search: "?kind=dose&type=spo2" })).toBe(
      `/app/groups/${G}/timeline/new/dose?kind=dose`,
    );
  });

  it("can start on a medication and a slot, replacing ones already in the search", () => {
    expect(appUrls.newDose(G, { medicationId: M, slot: "08:00", search: "?medication=x&slot=09:00" })).toBe(
      `/app/groups/${G}/timeline/new/dose?medication=${M}&slot=08%3A00`,
    );
  });

  it("can start on a pass", () => {
    expect(appUrls.newDose(G, { passId: M, search: "?kind=dose&pass=x" })).toBe(
      `/app/groups/${G}/timeline/new/dose?kind=dose&pass=${M}`,
    );
  });

  it("is dropped from the timeline a sheet closes to", () => {
    expect(appUrls.timeline(G, withoutSheetParams(`?kind=dose&medication=${M}&pass=${M}&slot=08:00`))).toBe(
      `/app/groups/${G}/timeline?kind=dose`,
    );
  });
});

describe("a new entry's start time (`?at=`)", () => {
  const AT = "2026-11-16T20:00:00.000Z";
  it("goes on the add sheets and the new entry page, after their other parameters", () => {
    expect(appUrls.newSheet("g", "vital", { type: "spo2", search: "?kind=vital", at: AT })).toBe(
      `/app/groups/g/timeline/new/vital?kind=vital&type=spo2&at=${encodeURIComponent(AT)}`,
    );
    expect(appUrls.newDose("g", { search: "?at=x", at: AT })).toBe(
      `/app/groups/g/timeline/new/dose?at=${encodeURIComponent(AT)}`,
    );
    expect(appUrls.newEntry("g", "note", { at: AT })).toBe(
      `/app/groups/g/entries/${NEW_ENTRY}?kind=note&at=${encodeURIComponent(AT)}`,
    );
    expect(appUrls.newEntry("g", "event", {})).toBe(`/app/groups/g/entries/${NEW_ENTRY}?kind=event`);
  });

  it("is dropped from the timeline a sheet closes to", () => {
    expect(appUrls.timeline("g", withoutSheetParams(`?kind=symptom&at=${AT}`))).toBe(
      "/app/groups/g/timeline?kind=symptom",
    );
  });

  it("reads back as an ISO time, or null when missing or not a time", () => {
    expect(startAtFrom(`?at=${encodeURIComponent(AT)}`)).toBe(AT);
    expect(startAtFrom({ at: "2026-11-16T12:00:00-08:00" })).toBe(AT);
    expect(startAtFrom("?at=tomorrow")).toBeNull();
    expect(startAtFrom("?kind=note")).toBeNull();
    expect(startAtFrom()).toBeNull();
  });
});

describe("appUrls.passSheet", () => {
  it("is the pass sheet over the timeline, carrying its filters but not another sheet's", () => {
    expect(appUrls.passSheet(G, "log1")).toBe(`/app/groups/${G}/timeline/pass/log1/edit`);
    expect(appUrls.passSheet("g", "log1", { search: "?kind=dose&type=spo2" })).toBe(
      "/app/groups/g/timeline/pass/log1/edit?kind=dose",
    );
  });
});
