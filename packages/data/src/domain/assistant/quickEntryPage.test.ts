import type { QuickEntryContext, QuickEntryReading } from "../../db/schema/assistant/quickEntry";

import { describe, expect, test } from "vitest";
import { parseQuickEntry } from "../../db/schema/assistant/quickEntry";
import { pageContextFor } from "./quickEntryPage";

// The box knows the page it opened on: a provider's page links a note or
// event that names no provider; a medication's page makes a dose line that
// names no medication a dose of it. What the line names always wins.

const APAP = "33333333-3333-4333-8333-333333333333";
const METO = "44444444-4444-4444-8444-444444444444";
const LEE = "55555555-5555-4555-8555-555555555555";
const ALV = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const GONE = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

/** Thursday, Nov 19, 2026, 8:00 in Los Angeles (16:00 UTC). */
const NOW = new Date("2026-11-19T16:00:00Z");

const context = (page?: QuickEntryContext["page"]): QuickEntryContext => ({
  now: NOW,
  timeZone: "America/Los_Angeles",
  units: { temperature: "f", weight: "lb", glucose: "mg/dL", volume: "mL" },
  medications: [
    {
      id: APAP,
      name: "Acetaminophen",
      strength: "500 mg",
      dose: "1 tablet",
      directions: "Tylenol, for pain",
    },
    { id: METO, name: "Metoprolol", strength: "25 mg", dose: "1 tablet" },
  ],
  providers: [
    { id: LEE, name: "Dr. Sandra Lee", type: "clinician", address: "40 Elm St" },
    { id: ALV, name: "Dr. Elena Alvarez", type: "clinician" },
  ],
  ...(page ? { page } : {}),
});

const parts = (line: string, page?: QuickEntryContext["page"]) => parseQuickEntry(line, context(page)).parts;
const top = (line: string, page?: QuickEntryContext["page"]) => parts(line, page)[0]!.readings[0]!;
const action = (r: QuickEntryReading) => r.actions[0]!;

const LEE_PAGE = { providerId: LEE };
const METO_PAGE = { medicationId: METO };

describe("pageContextFor", () => {
  test.each([
    ["a provider's page", { groupId: "g", providerId: LEE }, { providerId: LEE }],
    ["a medication's page", { groupId: "g", medicationId: METO }, { medicationId: METO }],
  ])("%s", (_, params, page) => {
    expect(pageContextFor(params)).toEqual(page);
  });

  test.each([
    ["the timeline", { groupId: "g" }],
    ["an entry", { groupId: "g", entryId: "e" }],
    ["a todo", { groupId: "g", todoId: "t" }],
    ["no params", {}],
    ["an empty id", { groupId: "g", providerId: "" }],
  ])("none on %s", (_, params) => {
    expect(pageContextFor(params)).toBeUndefined();
  });
});

describe("on a provider's page", () => {
  test("a note that names no provider links the page's", () => {
    const read = parts("called back, refill sent", LEE_PAGE);
    expect(read).toHaveLength(2);
    for (const part of read) {
      const r = part.readings[0]!;
      expect(r.kind).toBe("note");
      expect(action(r)).toMatchObject({ type: "addNote", providerIds: [LEE], text: part.text });
    }
  });

  test("an event that names no provider links the page's", () => {
    const r = top("follow up next tuesday", LEE_PAGE);
    expect(r.kind).toBe("event");
    expect(action(r)).toMatchObject({ type: "addEvent", title: "Follow up", providerIds: [LEE] });
  });

  test("the event reads as the same line naming the provider does", () => {
    const named = action(top("follow up with dr lee next tuesday"));
    expect(action(top("follow up next tuesday", LEE_PAGE))).toEqual(named);
  });

  test("an appointment word alone is an event with the page's provider", () => {
    const r = top("appt friday 2pm", LEE_PAGE);
    expect(r.kind).toBe("event");
    expect(action(r)).toMatchObject({
      title: "Event with Dr. Sandra Lee",
      place: "40 Elm St",
      providerIds: [LEE],
    });
  });

  test("a provider the line names wins", () => {
    const r = top("called dr alvarez", LEE_PAGE);
    expect(r.kind).toBe("note");
    expect(action(r)).toMatchObject({ providerIds: [ALV] });
  });

  test("a vital stays a vital", () => {
    expect(top("bp 120/80", LEE_PAGE).kind).toBe("vital");
  });

  test("a provider no longer in the group links nothing", () => {
    expect(action(top("called back", { providerId: GONE }))).toMatchObject({ providerIds: [] });
  });
});

describe("on a medication's page", () => {
  test.each([
    ["gave 1", "given", "1 tablet"],
    ["gave 2", "given", "2 tablets"],
    ["gave it", "given", "1 tablet"],
    ["gave her 1", "given", "1 tablet"],
    ["skipped", "skipped", "1 tablet"],
    ["refused", "refused", "1 tablet"],
    ["d: 1", "given", "1 tablet"],
  ])("%s is a dose of it", (line, status, amount) => {
    const r = top(line, METO_PAGE);
    expect(r.kind).toBe("dose");
    expect(action(r)).toMatchObject({ type: "logDose", medicationId: METO, status, amount, note: null });
  });

  test("a medication the line names wins", () => {
    const r = top("gave tylenol", METO_PAGE);
    expect(r.kind).toBe("dose");
    expect(action(r)).toMatchObject({ medicationId: APAP });
  });

  test.each([
    ["bp 120/80", "vital"],
    ["gave a bath", "note"],
    ["took a nap", "note"],
  ])("%s stays a %s", (line, kind) => {
    expect(top(line, METO_PAGE).kind).toBe(kind);
  });

  test("a medication no longer in the group makes no dose", () => {
    expect(top("gave 1", { medicationId: GONE }).kind).not.toBe("dose");
  });
});

describe("without a page, each line reads as today", () => {
  test.each([
    "called back, refill sent",
    "follow up next tuesday",
    "called dr alvarez",
    "gave 1",
    "gave it",
    "skipped",
    "refused",
    "gave tylenol",
    "bp 120/80",
  ])("%s", (line) => {
    expect(parts(line)).toEqual(parts(line, {}));
    for (const part of parts(line))
      for (const r of part.readings) {
        const a = action(r);
        if (a && "providerIds" in a && !/dr alvarez/.test(line)) expect(a.providerIds).toEqual([]);
        expect(a && a.type === "logDose" && a.medicationId === METO).toBe(false);
      }
  });
});
