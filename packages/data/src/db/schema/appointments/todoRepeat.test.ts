import type { ChainRow, RepeatingTodoFields } from "./todoRepeat";

import { describe, expect, it } from "vitest";
import { isUntouchedNext, nextDueDay, nextOccurrence, nextTodoId, occurrenceOn } from "./todoRepeat";

// Days around the appointments area's clock (Wed 2026-11-18): Mon 16th, Mon 23rd, …

const WEEKLY_MO = "FREQ=WEEKLY;INTERVAL=1;BYDAY=MO";
const CHAIN = "6f1c2a3b-4d5e-4f60-8a71-92b3c4d5e6f7";

const todo = (over: Partial<RepeatingTodoFields> = {}): RepeatingTodoFields => ({
  groupId: "0b7a1c2d-3e4f-4a5b-8c6d-7e8f9a0b1c2d",
  recipientId: "1c8b2d3e-4f5a-4b6c-9d7e-8f9a0b1c2d3e",
  title: "Put the bins out",
  assigneeId: "2d9c3e4f-5a6b-4c7d-8e9f-a0b1c2d3e4f5",
  assigneeName: null,
  dueOn: "2026-11-16",
  dueTime: "19:00",
  providerId: "3e0d4f5a-6b7c-4d8e-9f0a-b1c2d3e4f5a6",
  medicationId: "4f1e5a6b-7c8d-4e9f-8a0b-c2d3e4f5a6b7",
  repeatRule: WEEKLY_MO,
  repeatStartsOn: "2026-11-16",
  repeatId: CHAIN,
  ...over,
});

describe("nextDueDay", () => {
  it("weekly: the next rule day after the due day", () => {
    expect(nextDueDay(WEEKLY_MO, "2026-11-16", "2026-11-16", "2026-11-16")).toBe("2026-11-23");
    // Ticked early (on the Saturday before): still the Monday after the due day.
    expect(nextDueDay(WEEKLY_MO, "2026-11-16", "2026-11-23", "2026-11-21")).toBe("2026-11-30");
  });

  it("a tick three weeks late gives the next rule day after today, not the missed ones", () => {
    expect(nextDueDay(WEEKLY_MO, "2026-11-16", "2026-11-16", "2026-12-09")).toBe("2026-12-14");
    // Late on a rule day itself: the one after it.
    expect(nextDueDay(WEEKLY_MO, "2026-11-16", "2026-11-16", "2026-12-07")).toBe("2026-12-14");
  });

  it("every 2 weeks counts from the anchor, not the due day", () => {
    const rule = "FREQ=WEEKLY;INTERVAL=2;BYDAY=MO";
    expect(nextDueDay(rule, "2026-11-16", "2026-11-30", "2026-11-30")).toBe("2026-12-14");
    expect(nextDueDay(rule, "2026-11-16", "2026-11-30", "2026-12-02")).toBe("2026-12-14");
    // Ticked late into an off week: the next on-week Monday.
    expect(nextDueDay(rule, "2026-11-16", "2026-11-16", "2026-11-24")).toBe("2026-11-30");
    expect(nextDueDay(rule, "2026-11-23", "2026-11-23", "2026-11-23")).toBe("2026-12-07");
  });

  it("monthly by date and on the last Friday", () => {
    expect(
      nextDueDay("FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=15", "2026-11-15", "2026-11-15", "2026-11-18"),
    ).toBe("2026-12-15");
    const lastFriday = "FREQ=MONTHLY;INTERVAL=1;BYDAY=-1FR";
    expect(nextDueDay(lastFriday, "2026-11-27", "2026-11-27", "2026-11-27")).toBe("2026-12-25");
    expect(nextDueDay(lastFriday, "2026-11-27", "2026-12-25", "2026-12-26")).toBe("2027-01-29");
  });

  it("monthly on the last day: each next day is its month's last, through a leap February", () => {
    const rule = "FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=-1";
    const next = (due: string) => nextDueDay(rule, "2028-01-31", due, due);
    expect(next("2028-01-31")).toBe("2028-02-29");
    expect(next("2028-02-29")).toBe("2028-03-31");
    expect(next("2028-03-31")).toBe("2028-04-30");
    expect(next("2028-04-30")).toBe("2028-05-31");
    expect(nextDueDay(rule, "2027-01-31", "2027-01-31", "2027-01-31")).toBe("2027-02-28");
  });

  it("the last day every 2 months, with a count and with an end date", () => {
    const everyTwo = "FREQ=MONTHLY;INTERVAL=2;BYMONTHDAY=-1";
    expect(nextDueDay(everyTwo, "2028-01-31", "2028-01-31", "2028-01-31")).toBe("2028-03-31");
    const twice = "FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=-1;COUNT=2";
    expect(nextDueDay(twice, "2028-01-31", "2028-01-31", "2028-01-31")).toBe("2028-02-29");
    expect(nextDueDay(twice, "2028-01-31", "2028-02-29", "2028-02-29")).toBeNull();
    const until = "FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=-1;UNTIL=20280229";
    expect(nextDueDay(until, "2028-01-31", "2028-01-31", "2028-01-31")).toBe("2028-02-29");
    expect(nextDueDay(until, "2028-01-31", "2028-02-29", "2028-02-29")).toBeNull();
  });

  it("on the 31st still skips shorter months", () => {
    const rule = "FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=31";
    expect(nextDueDay(rule, "2028-01-31", "2028-01-31", "2028-01-31")).toBe("2028-03-31");
    expect(nextDueDay(rule, "2028-01-31", "2028-03-31", "2028-03-31")).toBe("2028-05-31");
  });

  it("daily, every N days", () => {
    expect(nextDueDay("FREQ=DAILY;INTERVAL=1", "2026-11-16", "2026-11-18", "2026-11-18")).toBe("2026-11-19");
    expect(nextDueDay("FREQ=DAILY;INTERVAL=3", "2026-11-16", "2026-11-16", "2026-11-17")).toBe("2026-11-19");
  });

  it("COUNT and UNTIL end the chain: null", () => {
    const twice = `${WEEKLY_MO};COUNT=2`;
    expect(nextDueDay(twice, "2026-11-16", "2026-11-16", "2026-11-16")).toBe("2026-11-23");
    expect(nextDueDay(twice, "2026-11-16", "2026-11-23", "2026-11-23")).toBeNull();
    const until = `${WEEKLY_MO};UNTIL=20261130`;
    expect(nextDueDay(until, "2026-11-16", "2026-11-23", "2026-11-23")).toBe("2026-11-30");
    expect(nextDueDay(until, "2026-11-16", "2026-11-30", "2026-11-30")).toBeNull();
    // Ticked after the end date: none either.
    expect(nextDueDay(until, "2026-11-16", "2026-11-23", "2026-12-01")).toBeNull();
  });

  it("a long interval keeps going past any search horizon (B-385)", () => {
    // Every 99 months: the next one is 8¼ years on.
    const months = "FREQ=MONTHLY;INTERVAL=99;BYMONTHDAY=16";
    expect(nextDueDay(months, "2026-11-16", "2026-11-16", "2026-11-16")).toBe("2035-02-16");
    // Ticked late: still the anchor's next rule day, not a day counted from today.
    expect(nextDueDay(months, "2026-11-16", "2026-11-16", "2027-03-01")).toBe("2035-02-16");
    expect(nextDueDay(months, "2026-11-16", "2035-02-16", "2035-02-16")).toBe("2043-05-16");
    const fridays = "FREQ=MONTHLY;INTERVAL=99;BYDAY=-1FR";
    expect(nextDueDay(fridays, "2026-11-27", "2026-11-27", "2026-11-27")).toBe("2035-02-23");
    expect(nextDueDay("FREQ=WEEKLY;INTERVAL=99;BYDAY=MO", "2026-11-16", "2026-11-16", "2026-11-16")).toBe(
      "2028-10-09",
    );
    expect(nextDueDay("FREQ=DAILY;INTERVAL=99", "2026-11-16", "2026-11-16", "2026-11-16")).toBe("2027-02-23");
  });

  it("a long interval still ends on its COUNT or UNTIL", () => {
    const twice = "FREQ=MONTHLY;INTERVAL=99;BYMONTHDAY=16;COUNT=2";
    expect(nextDueDay(twice, "2026-11-16", "2026-11-16", "2026-11-16")).toBe("2035-02-16");
    expect(nextDueDay(twice, "2026-11-16", "2035-02-16", "2035-02-16")).toBeNull();
    const until = "FREQ=MONTHLY;INTERVAL=99;BYMONTHDAY=16;UNTIL=20400101";
    expect(nextDueDay(until, "2026-11-16", "2026-11-16", "2026-11-16")).toBe("2035-02-16");
    expect(nextDueDay(until, "2026-11-16", "2035-02-16", "2035-02-16")).toBeNull();
  });

  it("yearly isn't a rule Caretook writes: none (B-385)", () => {
    expect(nextDueDay("FREQ=YEARLY;INTERVAL=99", "2026-11-16", "2026-11-16", "2026-11-16")).toBeNull();
  });

  it("an unreadable rule has none", () => {
    expect(nextDueDay("FREQ=HOURLY", "2026-11-16", "2026-11-16", "2026-11-16")).toBeNull();
  });
});

describe("nextTodoId", () => {
  it("is stable for (chain, day) and differs by either", () => {
    const id = nextTodoId(CHAIN, "2026-11-23");
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(nextTodoId(CHAIN.toUpperCase(), "2026-11-23")).toBe(id);
    expect(nextTodoId(CHAIN, "2026-11-30")).not.toBe(id);
    expect(nextTodoId("7a2f3b4c-5d6e-4f70-8b81-a3c4d5e6f708", "2026-11-23")).not.toBe(id);
  });
});

describe("nextOccurrence", () => {
  it("carries the title, assignee, time, provider and medication links and the repeat; not the appointment link, notes or done state", () => {
    const ticked = {
      ...todo(),
      eventId: "5a2f6b7c-8d9e-4f0a-9b1c-d3e4f5a6b7c8",
      doneAt: "2026-11-16T20:00:00Z",
    };
    expect(nextOccurrence(ticked, "2026-11-16")).toEqual({
      id: nextTodoId(CHAIN, "2026-11-23"),
      groupId: ticked.groupId,
      recipientId: ticked.recipientId,
      title: "Put the bins out",
      assigneeId: ticked.assigneeId,
      assigneeName: null,
      dueOn: "2026-11-23",
      dueTime: "19:00",
      providerId: ticked.providerId,
      medicationId: ticked.medicationId,
      eventId: null,
      doneAt: null,
      doneBy: null,
      deletedAt: null,
      repeatRule: WEEKLY_MO,
      repeatStartsOn: "2026-11-16",
      repeatId: CHAIN,
    });
  });

  it("a typed-in assignee carries too", () => {
    expect(nextOccurrence(todo({ assigneeId: null, assigneeName: "Aunt May" }), "2026-11-16")).toMatchObject({
      assigneeId: null,
      assigneeName: "Aunt May",
    });
  });

  it("is null for a todo that doesn't repeat, has no due day, or whose rule has ended", () => {
    expect(
      nextOccurrence(todo({ repeatRule: null, repeatStartsOn: null, repeatId: null }), "2026-11-16"),
    ).toBeNull();
    expect(nextOccurrence(todo({ dueOn: null }), "2026-11-16")).toBeNull();
    expect(nextOccurrence(todo({ repeatRule: `${WEEKLY_MO};COUNT=1` }), "2026-11-16")).toBeNull();
  });

  it("a successor moved back onto its source's day passes over its own id for the following day (B-386)", () => {
    // Made for Mon 23rd (so its id is that day's), moved back to Mon 16th
    // (the anchor moves with it) and ticked that day.
    const movedBack = { ...todo({ dueOn: "2026-11-16" }), id: nextTodoId(CHAIN, "2026-11-23") };
    expect(nextOccurrence(movedBack, "2026-11-16")).toMatchObject({
      id: nextTodoId(CHAIN, "2026-11-30"),
      dueOn: "2026-11-30",
    });
    // Not moved: the very next day, as ever.
    const kept = { ...todo({ dueOn: "2026-11-23" }), id: nextTodoId(CHAIN, "2026-11-23") };
    expect(nextOccurrence(kept, "2026-11-23")?.dueOn).toBe("2026-11-30");
  });

  it("passes over the ids it's given (done rows) to the first day whose id is free (B-386)", () => {
    const passOver = new Set([nextTodoId(CHAIN, "2026-11-23"), nextTodoId(CHAIN, "2026-11-30")]);
    expect(nextOccurrence(todo(), "2026-11-16", passOver)).toMatchObject({
      id: nextTodoId(CHAIN, "2026-12-07"),
      dueOn: "2026-12-07",
    });
    // Ids that aren't on the way change nothing.
    expect(nextOccurrence(todo(), "2026-11-16", new Set([nextTodoId(CHAIN, "2026-12-07")]))?.dueOn).toBe(
      "2026-11-23",
    );
  });

  it("passing over runs into the rule's end: none", () => {
    const twice = todo({ repeatRule: `${WEEKLY_MO};COUNT=2` });
    expect(nextOccurrence(twice, "2026-11-16", new Set([nextTodoId(CHAIN, "2026-11-23")]))).toBeNull();
  });
});

describe("isUntouchedNext", () => {
  const ticked = todo();
  const next = (): ChainRow => ({ ...occurrenceOn(ticked, "2026-11-23")! });

  it("is true for the occurrence just as ticking made it", () => {
    expect(isUntouchedNext(ticked, next())).toBe(true);
  });

  it("is false once it's edited, ticked or deleted", () => {
    expect(isUntouchedNext(ticked, { ...next(), title: "Bins and recycling" })).toBe(false);
    expect(isUntouchedNext(ticked, { ...next(), dueTime: "20:00" })).toBe(false);
    expect(isUntouchedNext(ticked, { ...next(), assigneeId: null })).toBe(false);
    expect(isUntouchedNext(ticked, { ...next(), repeatRule: "FREQ=WEEKLY;INTERVAL=2;BYDAY=MO" })).toBe(false);
    expect(isUntouchedNext(ticked, { ...next(), doneAt: "2026-11-23T20:00:00Z" })).toBe(false);
    expect(isUntouchedNext(ticked, { ...next(), deletedAt: "2026-11-23T20:00:00Z" })).toBe(false);
  });

  it("leaves links to its callers: the old event column isn't read (link rows are, by the caller)", () => {
    const withOldColumn = { ...next(), eventId: "5a2f6b7c-8d9e-4f0a-9b1c-d3e4f5a6b7c8" };
    expect(isUntouchedNext(ticked, withOldColumn)).toBe(true);
  });

  it("is false for a row moved to another day (its id no longer matches)", () => {
    expect(isUntouchedNext(ticked, { ...next(), dueOn: "2026-11-24" })).toBe(false);
  });
});
