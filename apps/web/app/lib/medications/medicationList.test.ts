import type { ListedMedication } from "./medicationList";

import { describe, expect, it } from "vitest";
import {
  clearStatus,
  compareMedications,
  matchesMedication,
  medicationList,
  parseMedicationFilters,
  setQuery,
  setStatus,
} from "./medicationList";
import { queryTokens } from "../providers/providerDirectory";

const med = (id: string, name: string, status: ListedMedication["status"], reason: string | null = null) => ({
  id,
  name,
  status,
  reason,
});

const SEEDED = [
  med("6", "Oxybutynin", "discontinued", "Bladder urgency"),
  med("1", "Lisinopril", "current", "Blood pressure"),
  med("5", "Amoxicillin", "completed", "Chest infection"),
  med("2", "metformin", "current", "Type 2 diabetes"),
  med("3", "Acetaminophen", "current", "Knee pain"),
  med("4", "Latanoprost", "current", "Eye pressure"),
];

describe("parseMedicationFilters", () => {
  it("reads the search and the status", () => {
    expect(parseMedicationFilters("?q=%20blood%20&status=current")).toEqual({
      q: "blood",
      status: "current",
    });
    expect(parseMedicationFilters("status=discontinued")).toEqual({ q: "", status: "discontinued" });
  });
  it("reads all, unknown and missing statuses as no filter", () => {
    expect(parseMedicationFilters("?status=all").status).toBeNull();
    expect(parseMedicationFilters("?status=stopped").status).toBeNull();
    expect(parseMedicationFilters("").status).toBeNull();
  });
});

describe("filter changes", () => {
  it("sets and clears the search, keeping the status and other parameters", () => {
    expect(setQuery("?status=current&x=1", " lis ")).toBe("?q=lis&status=current&x=1");
    expect(setQuery("?q=lis&status=current", "")).toBe("?status=current");
  });
  it("sets and clears the status", () => {
    expect(setStatus("?q=lis", "completed")).toBe("?q=lis&status=completed");
    expect(clearStatus("?q=lis&status=completed")).toBe("?q=lis");
    expect(clearStatus("?status=all")).toBe("");
  });
  it("returns the search as it was when nothing changes", () => {
    expect(setQuery("?q=lis&x=1", "lis")).toBe("?q=lis&x=1");
    expect(setStatus("?status=current", "current")).toBe("?status=current");
    expect(clearStatus("?q=lis")).toBe("?q=lis");
    expect(setStatus("?q=lis", "stopped" as never)).toBe("?q=lis");
  });
});

describe("order and matching", () => {
  it("puts current medications first, then the rest, each by name whatever its case", () => {
    expect([...SEEDED].sort(compareMedications).map((m) => m.name)).toEqual([
      "Acetaminophen",
      "Latanoprost",
      "Lisinopril",
      "metformin",
      "Amoxicillin",
      "Oxybutynin",
    ]);
  });
  it("matches every word in the name or the reason, ignoring case and accents", () => {
    const lis = SEEDED[1]!;
    expect(matchesMedication(lis, queryTokens("LISIN"))).toBe(true);
    expect(matchesMedication(lis, queryTokens("blood"))).toBe(true);
    expect(matchesMedication(lis, queryTokens("lisinopril préssure"))).toBe(true);
    expect(matchesMedication(lis, queryTokens("lisinopril knee"))).toBe(false);
    expect(matchesMedication(lis, [])).toBe(true);
    expect(matchesMedication(med("x", "Vitamin D", "current"), queryTokens("bone"))).toBe(false);
  });
});

describe("medicationList", () => {
  it("splits current from stopped, in display order", () => {
    const list = medicationList(SEEDED, { q: "", status: null });
    expect(list.current.map((m) => m.id)).toEqual(["3", "4", "1", "2"]);
    expect(list.stopped.map((m) => m.id)).toEqual(["5", "6"]);
  });
  it("filters by status and search together", () => {
    expect(medicationList(SEEDED, { q: "", status: "discontinued" })).toEqual({
      current: [],
      stopped: [SEEDED[0]],
    });
    expect(medicationList(SEEDED, { q: "pressure", status: null }).current.map((m) => m.name)).toEqual([
      "Latanoprost",
      "Lisinopril",
    ]);
    expect(medicationList(SEEDED, { q: "pressure", status: "completed" })).toEqual({
      current: [],
      stopped: [],
    });
  });
});
