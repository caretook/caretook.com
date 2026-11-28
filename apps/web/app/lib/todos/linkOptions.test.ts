import type { LinkCandidate, LinkPick } from "./linkOptions";

import { describe, expect, it } from "vitest";
import { linkOptions, linkSuggestions, linkTypeWord } from "./linkOptions";

const ZONE = "America/Los_Angeles";
const WHERE = { locale: "en-US", timeZone: ZONE };
// Thursday, Nov 20 2026, 12:00 in Los Angeles.
const NOW = new Date("2026-11-20T20:00:00Z");
const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const at = (ms: number) => new Date(NOW.getTime() + ms).toISOString();

const lark: LinkCandidate = {
  type: "provider",
  id: "p1",
  provider: {
    type: "clinician",
    name: "Dr. Mira Lark",
    specialty: "Cardiology",
    status: "current",
    practiceName: "Westside Family Medicine",
  },
};
const pharmacy: LinkCandidate = {
  type: "provider",
  id: "p2",
  provider: { type: "pharmacy", name: "Elm Pharmacy", specialty: null, status: "past", practiceName: null },
};
const metformin: LinkCandidate = {
  type: "medication",
  id: "m1",
  medication: { name: "Metformin", strength: "500 mg", status: "current" },
};
const stopped: LinkCandidate = {
  type: "medication",
  id: "m2",
  medication: { name: "Lisinopril", strength: null, status: "stopped" },
};
const visit: LinkCandidate = {
  type: "event",
  id: "e1",
  event: {
    id: "e1",
    kind: "event",
    title: "Cardiology follow-up",
    occurredAt: at(DAY - 1.5 * HOUR),
    timeZone: ZONE,
    deletedAt: null,
  },
};
const note: LinkCandidate = {
  type: "note",
  id: "n1",
  note: {
    kind: "note",
    title: null,
    occurredAt: at(-DAY),
    text: "Pharmacy said the refill is late\nCall back",
  },
};

describe("the Link to box's options", () => {
  it("names each type and gives its second line, in the given order", () => {
    expect(linkOptions([lark, metformin, visit, note], NOW, WHERE)).toEqual([
      {
        id: "p1",
        type: "provider",
        label: "Dr. Mira Lark",
        description: "Cardiology · Westside Family Medicine",
        providerType: "clinician",
      },
      { id: "m1", type: "medication", label: "Metformin", description: "500 mg" },
      { id: "e1", type: "event", label: "Cardiology follow-up", description: "Tomorrow 10:30 AM" },
      { id: "n1", type: "note", label: "Pharmacy said the refill is late", description: "Yesterday" },
    ]);
  });

  it("marks a past provider, says a provider's type without a specialty, and a stopped medication", () => {
    const [p, m] = linkOptions([pharmacy, stopped], NOW, WHERE);
    expect(p).toMatchObject({
      label: "Elm Pharmacy",
      description: "Pharmacy · Past",
      providerType: "pharmacy",
    });
    expect(m).toMatchObject({ label: "Lisinopril", description: "Stopped" });
  });

  it("leaves out what's linked already", () => {
    expect(
      linkOptions([lark, metformin, visit, note], NOW, { ...WHERE, linked: ["p1", "e1"] }).map((o) => o.id),
    ).toEqual(["m1", "n1"]);
  });
});

describe("a typed type word", () => {
  it.each([
    ["provider lee", "provider", "lee"],
    ["Providers Lee Smith", "provider", "Lee Smith"],
    ["Dr. Lee", "provider", "Lee"],
    ["doctor lark", "provider", "lark"],
    ["metformin med", "medication", "metformin"],
    ["MEDS refill", "medication", "refill"],
    ["medication metformin", "medication", "metformin"],
    ["appt cardiology", "event", "cardiology"],
    ["cardiology appointment", "event", "cardiology"],
    ["events lark", "event", "lark"],
    ["note diet", "note", "diet"],
    ["diet notes", "note", "diet"],
    ["Nóte diet", "note", "diet"],
  ])("%s: the first or last word names the type", (text, type, rest) => {
    expect(linkTypeWord(text)).toEqual({ type, rest });
  });

  it("reads the first word before the last", () => {
    expect(linkTypeWord("note about meds")).toEqual({ type: "note", rest: "about meds" });
  });

  it("names its type alone, leaving nothing to search", () => {
    expect(linkTypeWord("med")).toEqual({ type: "medication", rest: "" });
    expect(linkTypeWord(" notes ")).toEqual({ type: "note", rest: "" });
  });

  it("is no type word in the middle, inside a word or missing", () => {
    expect(linkTypeWord("lee provider smith")).toEqual({ type: null, rest: "lee provider smith" });
    expect(linkTypeWord("medford clinic")).toEqual({ type: null, rest: "medford clinic" });
    expect(linkTypeWord("lark")).toEqual({ type: null, rest: "lark" });
    expect(linkTypeWord("")).toEqual({ type: null, rest: "" });
  });
});

describe("the empty box's suggestions (B-947)", () => {
  const provider = (id: string): LinkPick => ({ type: "provider", id });
  const event = (id: string): LinkPick => ({ type: "event", id });
  const med = (id: string): LinkPick => ({ type: "medication", id });
  const noteOf = (id: string): LinkPick => ({ type: "note", id });
  const ids = (picks: LinkPick[]) => picks.map((p) => p.id);

  it("goes came-from, then the next 3 upcoming events, then the last 5 recently viewed", () => {
    expect(
      ids(
        linkSuggestions({
          cameFrom: provider("p1"),
          upcoming: [event("e1"), event("e2"), event("e3"), event("e4")],
          recent: [med("m1"), noteOf("n1"), provider("p2"), med("m2"), noteOf("n2"), provider("p3")],
        }),
      ),
    ).toEqual(["p1", "e1", "e2", "e3", "m1", "n1", "p2", "m2", "n2"]);
  });

  it("lists each once, where it first comes, and the counts are of what's left", () => {
    expect(
      ids(
        linkSuggestions({
          cameFrom: event("e1"),
          upcoming: [event("e1"), event("e2"), event("e3"), event("e4")],
          recent: [event("e2"), med("m1"), med("m1"), provider("p1")],
        }),
      ),
    ).toEqual(["e1", "e2", "e3", "e4", "m1", "p1"]);
  });

  it("leaves out what's linked, the came-from record too", () => {
    expect(
      ids(
        linkSuggestions({
          cameFrom: provider("p1"),
          upcoming: [event("e1"), event("e2")],
          recent: [med("m1"), provider("p1")],
          linked: ["p1", "e1", "m1"],
        }),
      ),
    ).toEqual(["e2"]);
  });

  it("keeps only the chip's type when one is on", () => {
    const all = {
      cameFrom: provider("p1"),
      upcoming: [event("e1"), event("e2")],
      recent: [med("m1"), provider("p2"), noteOf("n1"), event("e3")],
    };
    expect(ids(linkSuggestions({ ...all, type: "provider" }))).toEqual(["p1", "p2"]);
    expect(ids(linkSuggestions({ ...all, type: "event" }))).toEqual(["e1", "e2", "e3"]);
    expect(ids(linkSuggestions({ ...all, type: "medication" }))).toEqual(["m1"]);
    expect(ids(linkSuggestions({ ...all, type: "note" }))).toEqual(["n1"]);
  });

  it("is none with nothing to suggest", () => {
    expect(linkSuggestions({})).toEqual([]);
    expect(linkSuggestions({ cameFrom: null, upcoming: [], recent: [], linked: [], type: null })).toEqual([]);
    expect(linkSuggestions({ cameFrom: provider("p1"), type: "note" })).toEqual([]);
  });
});
