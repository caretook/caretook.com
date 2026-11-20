import type { DueDose, DueMedication } from "../medications/dueDoses";

import { describe, expect, it } from "vitest";
import { dueDoses } from "../medications/dueDoses";
import { upcomingSections } from "./upcomingDays";
import {
  doseItemText,
  doseLinkLabel,
  doseStateLabel,
  isUpcomingDose,
  showsDoses,
  upcomingDoses,
  withDueDoses,
} from "./upcomingDoses";

const LA = "America/Los_Angeles";
// Wednesday, Nov 18, 2026, 10:00 AM in Los Angeles.
const NOW = new Date("2026-11-18T18:00:00.000Z");

const med = (
  id: string,
  name: string,
  times: string[],
  extra: Partial<DueMedication> = {},
): DueMedication => ({
  id,
  name,
  strength: "10 mg",
  dose: "1 tablet",
  schedule: { type: "scheduled", slots: times.map((time) => ({ time })) },
  status: "current",
  deletedAt: null,
  ...extra,
});

const given = (id: string, medicationId: string, occurredAt: string, scheduledFor: string): DueDose => ({
  id,
  occurredAt,
  details: { medicationId, status: "given", scheduledFor },
});

const due = (medications: DueMedication[], doses: DueDose[] = [], now = NOW) =>
  dueDoses({ medications, doses, now, timeZone: LA });

type Item = {
  id: string;
  occurredAt: string;
  timeZone: string;
  endsAt?: string | null;
  allDay?: boolean;
  cancelledAt?: string | null;
};
const entry = (id: string, occurredAt: string, extra: Partial<Item> = {}): Item => ({
  id,
  occurredAt,
  timeZone: LA,
  ...extra,
});
const shape = (sections: { label: string; items: (Item | { type: "dueDose"; key: string })[] }[]) =>
  sections.map((s) => [s.label, s.items.map((i) => ("type" in i ? i.key : i.id))]);

describe("upcomingDoses", () => {
  it("keeps today's open slots, in time order, with their state", () => {
    const items = upcomingDoses(
      due([med("met", "Metformin", ["07:00", "08:45", "20:00"]), med("lis", "Lisinopril", ["09:30"])]),
    );
    expect(items.map((d) => [d.key, d.state])).toEqual([
      ["met@07:00", "overdue"],
      ["met@08:45", "overdue"],
      ["lis@09:30", "due"],
      ["met@20:00", "upcoming"],
    ]);
    expect(items[0]).toMatchObject({
      type: "dueDose",
      medicationId: "met",
      title: "Metformin 10 mg",
      time: "07:00",
      at: "2026-11-18T15:00:00.000Z",
    });
  });

  it("drops slots a dose answered (given, skipped or refused)", () => {
    const doses: DueDose[] = [
      given("d1", "met", "2026-11-18T15:05:00.000Z", "07:00"),
      {
        id: "d2",
        occurredAt: "2026-11-18T17:40:00.000Z",
        details: { medicationId: "lis", status: "skipped", scheduledFor: "09:30" },
      },
    ];
    const items = upcomingDoses(
      due([med("met", "Metformin", ["07:00", "20:00"]), med("lis", "Lisinopril", ["09:30"])], doses),
    );
    expect(items.map((d) => d.key)).toEqual(["met@20:00"]);
  });

  it("makes a pass one item while anything in it is open, and drops it once it's done", () => {
    const P = "11111111-1111-4111-8111-111111111111";
    const passes = [{ id: P, name: "Morning", time: "09:30", sortOrder: 0 }];
    const inPass = (id: string, name: string) =>
      med(id, name, [], { schedule: { type: "scheduled", slots: [{ passId: P }] } });
    const meds = [inPass("met", "Metformin"), inPass("lis", "Lisinopril"), med("asp", "Aspirin", ["09:30"])];
    const run = (doses: DueDose[] = []) =>
      upcomingDoses(dueDoses({ medications: meds, passes, doses, now: NOW, timeZone: LA }), passes);
    const items = run();
    expect(items.map((d) => [d.key, d.state, d.count])).toEqual([
      [`pass:${P}`, "due", 2],
      ["asp@09:30", "due", 1],
    ]);
    expect(items[0]).toMatchObject({ passId: P, medicationId: null, title: "Morning" });
    expect(doseItemText(items[0]!)).toBe("Morning · 2 medications");
    expect(doseItemText(items[1]!)).toBe("Aspirin 10 mg dose");
    expect(doseLinkLabel(items[0]!, "9:30 AM")).toBe("Log Morning, 9:30 AM, 2 medications, due");

    const partly = run([given("d1", "met", "2026-11-18T17:35:00.000Z", "09:30")]);
    expect(partly.map((d) => [d.key, d.count])).toEqual([
      [`pass:${P}`, 1],
      ["asp@09:30", 1],
    ]);
    const done = run([
      given("d1", "met", "2026-11-18T17:35:00.000Z", "09:30"),
      given("d2", "lis", "2026-11-18T17:36:00.000Z", "09:30"),
    ]);
    expect(done.map((d) => d.key)).toEqual(["asp@09:30"]);
  });

  it("leaves out yesterday's missed slots, as-needed, stopped and deleted medications", () => {
    const items = upcomingDoses(
      due([
        med("prn", "Acetaminophen", [], { schedule: { type: "asNeeded", maxPerDay: 4 } }),
        med("old", "Amoxicillin", ["12:00"], { status: "completed" }),
        med("gone", "Oxybutynin", ["12:00"], { deletedAt: "2026-11-01T00:00:00.000Z" }),
      ]),
    );
    expect(items).toEqual([]);
  });
});

describe("withDueDoses", () => {
  it("orders doses by time among the day's items, after all-day ones, under Today", () => {
    const entries = [
      entry("all-day", "2026-11-18T08:00:00.000Z", { allDay: true }),
      entry("noon-visit", "2026-11-18T20:00:00.000Z"),
      entry("tomorrow", "2026-11-19T17:00:00.000Z"),
    ];
    const doses = upcomingDoses(due([med("met", "Metformin", ["08:00", "11:00", "13:00"])]));
    const sections = withDueDoses(upcomingSections(entries, NOW, LA, "en-US"), doses, NOW, LA, "en-US");
    expect(shape(sections)).toEqual([
      ["Today", ["all-day", "met@08:00", "met@11:00", "noon-visit", "met@13:00"]],
      ["Tomorrow", ["tomorrow"]],
    ]);
  });

  it("puts a due or overdue dose under Today, never under Now", () => {
    const entries = [entry("visit", "2026-11-18T17:30:00.000Z", { endsAt: "2026-11-18T19:00:00.000Z" })];
    const doses = upcomingDoses(due([med("met", "Metformin", ["09:00"])]));
    const sections = withDueDoses(upcomingSections(entries, NOW, LA, "en-US"), doses, NOW, LA, "en-US");
    expect(shape(sections)).toEqual([
      ["Now", ["visit"]],
      ["Today", ["met@09:00"]],
    ]);
  });

  it("adds a Today section before later days when only doses are today", () => {
    const entries = [entry("friday", "2026-11-20T17:00:00.000Z")];
    const doses = upcomingDoses(due([med("met", "Metformin", ["20:00"])]));
    const sections = withDueDoses(upcomingSections(entries, NOW, LA, "en-US"), doses, NOW, LA, "en-US");
    expect(shape(sections)).toEqual([
      ["Today", ["met@20:00"]],
      ["Friday, Nov 20", ["friday"]],
    ]);
    expect(sections[0]?.key).toBe("2026-11-18");
  });

  it("is the sections unchanged without doses, and doesn't change its input", () => {
    const sections = upcomingSections([entry("later", "2026-11-18T22:00:00.000Z")], NOW, LA, "en-US");
    const before = JSON.stringify(sections);
    expect(shape(withDueDoses(sections, [], NOW, LA))).toEqual([["Today", ["later"]]]);
    withDueDoses(sections, upcomingDoses(due([med("met", "Metformin", ["20:00"])])), NOW, LA);
    expect(JSON.stringify(sections)).toBe(before);
  });

  it("lists doses alone when nothing else is upcoming", () => {
    const doses = upcomingDoses(due([med("met", "Metformin", ["20:00"])]));
    const sections = withDueDoses([], doses, NOW, LA, "en-US");
    expect(shape(sections)).toEqual([["Today", ["met@20:00"]]]);
    expect(sections[0]?.items.every(isUpcomingDose)).toBe(true);
  });
});

describe("wording and filters", () => {
  it("labels the state", () => {
    expect(doseStateLabel("due")).toBe("Due");
    expect(doseStateLabel("overdue")).toBe("Overdue");
    expect(doseStateLabel("upcoming")).toBeNull();
  });

  it("names the writer's link", () => {
    const [overdue, later] = upcomingDoses(due([med("met", "Metformin", ["07:00", "20:00"])]));
    expect(doseLinkLabel(overdue!, "7:00 AM")).toBe("Log Metformin 10 mg, 7:00 AM dose, overdue");
    expect(doseLinkLabel(later!, "8:00 PM")).toBe("Log Metformin 10 mg, 8:00 PM dose");
  });

  it("shows doses only without a kind or author filter", () => {
    expect(showsDoses({})).toBe(true);
    expect(showsDoses({ kind: null, author: null })).toBe(true);
    expect(showsDoses({ kind: "event" })).toBe(false);
    expect(showsDoses({ author: "a8c1f0e2-0000-4000-8000-000000000001" })).toBe(false);
  });
});
