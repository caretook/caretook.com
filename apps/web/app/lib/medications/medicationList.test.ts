import type { ListedMedication } from "./medicationList";

import { describe, expect, it } from "vitest";
import {
  clearFilters,
  clearStatus,
  clearTag,
  compareMedications,
  matchesMedication,
  medicationList,
  parseMedicationFilters,
  setQuery,
  clearType,
  setStatus,
  setTag,
  setType,
} from "./medicationList";
import { queryTokens } from "../providers/providerDirectory";

const med = (
  id: string,
  name: string,
  status: ListedMedication["status"],
  reason: string | null = null,
  type: ListedMedication["type"] = "prescription",
) => ({
  id,
  name,
  status,
  reason,
  type,
});

const SEEDED = [
  med("6", "Oxybutynin", "discontinued", "Bladder urgency", null),
  med("1", "Lisinopril", "current", "Blood pressure"),
  med("5", "Amoxicillin", "completed", "Chest infection"),
  med("2", "metformin", "current", "Type 2 diabetes"),
  med("3", "Acetaminophen", "current", "Knee pain", "otc"),
  med("4", "Latanoprost", "current", "Eye pressure"),
];

describe("parseMedicationFilters", () => {
  it("reads the search and the status", () => {
    expect(parseMedicationFilters("?q=%20blood%20&status=current")).toEqual({
      q: "blood",
      status: "current",
      type: null,
      tag: null,
    });
    expect(parseMedicationFilters("status=discontinued")).toEqual({
      q: "",
      status: "discontinued",
      type: null,
      tag: null,
    });
  });
  it("reads all, unknown and missing statuses as no filter", () => {
    expect(parseMedicationFilters("?status=all").status).toBeNull();
    expect(parseMedicationFilters("?status=stopped").status).toBeNull();
    expect(parseMedicationFilters("").status).toBeNull();
  });
});

describe("the type in the URL", () => {
  it("reads one type, and unknown, missing or empty ones as no filter", () => {
    expect(parseMedicationFilters("?type=otc").type).toBe("otc");
    expect(parseMedicationFilters("?q=x&status=current&type=supplement")).toEqual({
      q: "x",
      status: "current",
      type: "supplement",
      tag: null,
    });
    expect(parseMedicationFilters("?type=all").type).toBeNull();
    expect(parseMedicationFilters("?type=").type).toBeNull();
    expect(parseMedicationFilters("").type).toBeNull();
  });
  it("sets the type after q and status, keeping other parameters", () => {
    expect(setType("?q=lis&status=current&x=1", "otc")).toBe("?q=lis&status=current&type=otc&x=1");
    expect(setType("?type=otc", "supplement")).toBe("?type=supplement");
    expect(setType("?x=1", "other")).toBe("?type=other&x=1");
  });
  it("clears the type, keeping the rest", () => {
    expect(clearType("?q=lis&type=otc&status=current")).toBe("?q=lis&status=current");
    expect(clearType("?type=otc")).toBe("");
  });
  it("tidies an unknown type on the next change and changes nothing otherwise", () => {
    expect(clearType("?type=all&q=a")).toBe("?q=a");
    expect(setQuery("?type=typo&q=a", "b")).toBe("?q=b");
    expect(setStatus("?type=otc", "current")).toBe("?status=current&type=otc");
    expect(setType("?type=otc", "otc")).toBe("?type=otc");
    expect(clearType("?q=lis")).toBe("?q=lis");
    expect(setType("?q=lis", "bogus" as never)).toBe("?q=lis");
  });
  it("is kept when the search or status changes", () => {
    expect(setQuery("?type=otc", "a")).toBe("?q=a&type=otc");
    expect(setStatus("?q=a&type=otc", "completed")).toBe("?q=a&status=completed&type=otc");
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
    const list = medicationList(SEEDED, { q: "", status: null, type: null });
    expect(list.current.map((m) => m.id)).toEqual(["3", "4", "1", "2"]);
    expect(list.stopped.map((m) => m.id)).toEqual(["5", "6"]);
  });
  it("filters by status and search together", () => {
    expect(medicationList(SEEDED, { q: "", status: "discontinued", type: null })).toEqual({
      current: [],
      stopped: [SEEDED[0]],
    });
    expect(
      medicationList(SEEDED, { q: "pressure", status: null, type: null }).current.map((m) => m.name),
    ).toEqual(["Latanoprost", "Lisinopril"]);
    expect(medicationList(SEEDED, { q: "pressure", status: "completed", type: null })).toEqual({
      current: [],
      stopped: [],
    });
  });
  it("filters by type, alone and with status and search", () => {
    const names = (f: Parameters<typeof medicationList>[1]) => {
      const l = medicationList(SEEDED, f);
      return [...l.current, ...l.stopped].map((m) => m.name);
    };
    expect(names({ q: "", status: null, type: "otc" })).toEqual(["Acetaminophen"]);
    expect(names({ q: "", status: null, type: "supplement" })).toEqual([]);
    expect(names({ q: "", status: "current", type: "prescription" })).toEqual([
      "Latanoprost",
      "Lisinopril",
      "metformin",
    ]);
    expect(names({ q: "", status: "discontinued", type: "prescription" })).toEqual([]);
    expect(names({ q: "pressure", status: "current", type: "prescription" })).toEqual([
      "Latanoprost",
      "Lisinopril",
    ]);
    expect(names({ q: "pain", status: null, type: "prescription" })).toEqual([]);
  });
  it("leaves out medications with no type when a type is chosen", () => {
    const l = medicationList(SEEDED, { q: "", status: null, type: "prescription" });
    expect(l.stopped.map((m) => m.name)).toEqual(["Amoxicillin"]);
  });
});

describe("the tag filter (tags PRD)", () => {
  const TAG = "1f0e9d8c-7b6a-4954-8a3b-2c1d0e9f8a7b";
  const OTHER = "2a1b0c9d-8e7f-4a6b-9c5d-4e3f2a1b0c9d";
  const tags = new Map([
    ["1", [{ id: TAG, name: "Heart" }]],
    ["5", [{ id: TAG, name: "Heart" }]],
    ["3", [{ id: OTHER, name: "Knee" }]],
  ]);

  it("reads one tag id, and anything else as no tag", () => {
    expect(parseMedicationFilters(`?status=current&tag=${TAG}`).tag).toBe(TAG);
    expect(parseMedicationFilters("?tag=heart").tag).toBeNull();
    expect(parseMedicationFilters("").tag).toBeNull();
  });

  it("sets and clears the tag after q, status and type, keeping the rest", () => {
    expect(setTag("?q=lis&status=current&type=otc&x=1", TAG)).toBe(
      `?q=lis&status=current&type=otc&tag=${TAG}&x=1`,
    );
    expect(setTag("?x=1", "heart")).toBe("?x=1");
    expect(clearTag(`?tag=${TAG}&status=completed`)).toBe("?status=completed");
    expect(setStatus(`?tag=${TAG}`, "current")).toBe(`?status=current&tag=${TAG}`);
    expect(setTag(`?tag=${TAG}`, TAG)).toBe(`?tag=${TAG}`);
  });

  it("Clear filters drops the status, type and tag, keeping the search", () => {
    expect(clearFilters(`?q=lis&status=current&type=otc&tag=${TAG}&x=1`)).toBe("?q=lis&x=1");
  });

  it("narrows the list to the medications carrying the tag, with the other filters", () => {
    const names = (f: Parameters<typeof medicationList>[1]) => {
      const l = medicationList(SEEDED, f, tags);
      return [...l.current, ...l.stopped].map((m) => m.name);
    };
    expect(names({ q: "", status: null, type: null, tag: TAG })).toEqual(["Lisinopril", "Amoxicillin"]);
    expect(names({ q: "", status: "current", type: null, tag: TAG })).toEqual(["Lisinopril"]);
    expect(names({ q: "", status: null, type: "otc", tag: OTHER })).toEqual(["Acetaminophen"]);
    expect(names({ q: "chest", status: null, type: null, tag: TAG })).toEqual(["Amoxicillin"]);
    expect(names({ q: "", status: null, type: null, tag: null })).toHaveLength(6);
  });
});
