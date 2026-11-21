import { describe, expect, it } from "vitest";
import { ruleText } from "@caretook/data/schema";
import {
  choiceOfRule,
  choiceRule,
  defaultChoice,
  draftTiming,
  monthlyLabels,
  monthWeekOf,
  toggleWeekday,
  weekdayOf,
} from "./repeatChoice";

// The appointments area's clock: Wed 2026-11-18, in Los Angeles.
const WED = "2026-11-18";
const LA = "America/Los_Angeles";

describe("repeat choices", () => {
  it("know a day's weekday and its week in the month", () => {
    expect(weekdayOf(WED)).toBe("WE");
    expect(weekdayOf("2026-11-22")).toBe("SU");
    expect(monthWeekOf(WED)).toBe(3);
    expect(monthWeekOf("2026-11-29")).toBe(-1);
    expect(monthlyLabels(WED)).toEqual({ date: "On the 18th", weekday: "On the 3rd Wednesday" });
    expect(monthlyLabels("2026-11-30").weekday).toBe("On the last Monday");
    // A stored rule's ordinal and weekday win over the start's (the saved rule keeps them).
    expect(monthlyLabels("2027-02-26", { nth: -1, weekday: "FR" }).weekday).toBe("On the last Friday");
    expect(monthlyLabels("2027-02-26", { nth: 2, weekday: "TU" }).weekday).toBe("On the 2nd Tuesday");
  });

  it("start with no repeat, weekly on the first day's weekday if picked", () => {
    const choice = defaultChoice(WED);
    expect(choiceRule(choice, WED)).toBeNull();
    const weekly = choiceRule({ ...choice, preset: "weekly" }, WED);
    expect(weekly && ruleText(weekly)).toBe("FREQ=WEEKLY;INTERVAL=1;BYDAY=WE");
  });

  it("make each preset's rule, and custom's interval and unit", () => {
    const base = defaultChoice(WED);
    const text = (over: Partial<typeof base>) => {
      const rule = choiceRule({ ...base, ...over }, WED);
      return rule && ruleText(rule);
    };
    expect(text({ preset: "daily" })).toBe("FREQ=DAILY;INTERVAL=1");
    expect(text({ preset: "weekly", weekdays: ["FR", "MO", "WE"] })).toBe(
      "FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,WE,FR",
    );
    expect(text({ preset: "monthly" })).toBe("FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=18");
    expect(text({ preset: "monthly", monthlyBy: "weekday" })).toBe("FREQ=MONTHLY;INTERVAL=1;BYDAY=3WE");
    expect(text({ preset: "custom", unit: "daily", interval: 3, end: "after", count: 12 })).toBe(
      "FREQ=DAILY;INTERVAL=3;COUNT=12",
    );
    expect(
      text({
        preset: "custom",
        unit: "weekly",
        interval: 4,
        weekdays: ["TU"],
        end: "on",
        until: "2027-01-31",
      }),
    ).toBe("FREQ=WEEKLY;INTERVAL=4;BYDAY=TU;UNTIL=20270131");
    // The presets always repeat every 1, whatever custom last held.
    expect(text({ preset: "daily", interval: 5 })).toBe("FREQ=DAILY;INTERVAL=1");
  });

  it("toggle weekdays", () => {
    const choice = toggleWeekday(toggleWeekday(defaultChoice(WED), "MO"), "WE");
    expect(choice.weekdays).toEqual(["MO"]);
  });
});

describe("draftTiming", () => {
  it("takes the first day and time in the recipient's zone, and an event's length", () => {
    expect(
      draftTiming(
        { occurredAt: "2026-11-18T14:00:00.000Z", endsAt: "2026-11-18T18:00:00.000Z", allDay: false },
        { entryTimeZone: "America/New_York", recipientTimeZone: LA },
      ),
    ).toEqual({ startsOn: WED, startTime: "06:00", allDay: false, timeZone: LA, durationMinutes: 240 });
  });

  it("keeps an all-day item's day from its own zone, with no time or length", () => {
    expect(
      draftTiming(
        { occurredAt: "2026-11-18T05:00:00.000Z", endsAt: null, allDay: true },
        { entryTimeZone: "America/New_York", recipientTimeZone: LA },
      ),
    ).toEqual({ startsOn: WED, startTime: null, allDay: true, timeZone: LA, durationMinutes: null });
  });
});

describe("choiceOfRule", () => {
  it("gives back the choice a rule was made from", () => {
    const start = "2026-11-20";
    for (const choice of [
      { ...defaultChoice(start), preset: "weekly" as const, weekdays: ["MO", "WE", "FR"] as const },
      { ...defaultChoice(start), preset: "daily" as const, end: "after" as const, count: 12 },
      { ...defaultChoice(start), preset: "monthly" as const, monthlyBy: "weekday" as const },
      {
        ...defaultChoice(start),
        preset: "custom" as const,
        interval: 4,
        unit: "weekly" as const,
        end: "on" as const,
        until: "2027-03-01",
      },
    ]) {
      const rule = ruleText(choiceRule({ ...choice, weekdays: [...choice.weekdays] }, start)!);
      expect(ruleText(choiceRule(choiceOfRule(rule, start), start)!)).toBe(rule);
    }
  });

  it("keeps a stored ordinal and weekday, the last Friday from a four-Friday month", () => {
    const start = "2027-02-26"; // a month with four Fridays
    for (const rule of ["FREQ=MONTHLY;INTERVAL=1;BYDAY=-1FR", "FREQ=MONTHLY;INTERVAL=1;BYDAY=2TU"]) {
      const choice = choiceOfRule(rule, start);
      expect(ruleText(choiceRule(choice, start)!)).toBe(rule);
    }
  });

  it("builds from the date once the repeat changes", () => {
    const start = "2027-02-26";
    const choice = { ...choiceOfRule("FREQ=MONTHLY;INTERVAL=1;BYDAY=-1FR", start), keptWeekday: undefined };
    expect(ruleText(choiceRule(choice, start)!)).toBe(
      ruleText(choiceRule({ ...choice, monthlyBy: "weekday" }, start)!),
    );
    expect(choiceRule({ ...choice, monthlyBy: "weekday" }, start)!.monthly).toEqual({
      by: "weekday",
      nth: 4,
      weekday: "FR",
    });
  });

  it("starts from the default for an unreadable rule", () => {
    expect(choiceOfRule("FREQ=YEARLY", "2026-11-20")).toEqual(defaultChoice("2026-11-20"));
  });
});
