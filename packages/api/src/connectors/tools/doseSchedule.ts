import type { DueMedication } from "@caretook/data";

import {
  dayInZone,
  doseSchedule as planAhead,
  isError,
  medicationPassService,
  medicationService,
  medicationTitle,
  newError,
  normalizeSchedule,
} from "@caretook/data";
import { z } from "zod";
import { defineTool, READ_ANNOTATIONS } from "../registry";
import { zonedIso } from "../time";
import { asMember, loadGroup } from "./shared";

/** `dose_schedule` reads this many days by default, and at most MAX. */
export const DOSE_SCHEDULE_DEFAULT_DAYS = 7;
export const DOSE_SCHEDULE_MAX_DAYS = 14;

/** What a `from` before today is answered with: the plan is ahead; what was given is the timeline's. */
export const PAST_SCHEDULE_REFUSAL =
  "The schedule is for today onward. Use list_timeline for doses already logged.";

const input = z.object({
  from: z.iso
    .date()
    .optional()
    .describe(
      "The first day, YYYY-MM-DD in the care recipient's time zone (default today; not before today).",
    ),
  days: z
    .int()
    .min(1)
    .max(DOSE_SCHEDULE_MAX_DAYS)
    .optional()
    .describe(`How many days (at most ${DOSE_SCHEDULE_MAX_DAYS}; default ${DOSE_SCHEDULE_DEFAULT_DAYS}).`),
});

/** "Friday", for a "YYYY-MM-DD" day. */
const weekdayOf = (day: string) =>
  new Date(`${day}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" });

/**
 * The medication plan from today on, from the due-dose core's slots
 * (`doseSchedule`): each day's rounds as Today shows them, with times in the
 * recipient's offset, and the as-needed medications. No doses are read: what
 * was given is todays_doses' and the timeline's.
 */
export const doseSchedule = defineTool({
  name: "dose_schedule",
  title: "Dose schedule",
  description: `The medication plan from today on, in the care recipient's day: for each day, each med time (such as Morning) or medication's own time, with its time and the medications and amounts given then, and the as-needed medications with their daily maximum. It is the plan, not what was given: for today's given, due and missed doses use todays_doses. From today by default, ${DOSE_SCHEDULE_DEFAULT_DAYS} days, at most ${DOSE_SCHEDULE_MAX_DAYS}.`,
  scope: "read",
  input,
  annotations: READ_ANNOTATIONS,
  handler: async (args, ctx) => {
    const loaded = await loadGroup(ctx);
    if (isError(loaded)) return loaded;
    const { timeZone } = loaded;
    const today = dayInZone(ctx.now, timeZone);
    const from = args.from ?? today;
    if (from < today)
      return newError({
        code: "connectorTool:invalid",
        meta: { issues: [{ path: "from", message: PAST_SCHEDULE_REFUSAL }] },
      });
    const dayCount = args.days ?? DOSE_SCHEDULE_DEFAULT_DAYS;

    const meds = await medicationService.list(asMember(ctx), { groupId: ctx.groupId });
    if (isError(meds)) return meds;
    const passes = await medicationPassService.list(asMember(ctx), {
      groupId: ctx.groupId,
      includeDeleted: true,
    });
    if (isError(passes)) return passes;

    const medications = meds.data.flatMap((m): DueMedication[] => {
      const schedule = normalizeSchedule(m.schedule);
      if (!schedule || m.status !== "current") return [];
      return [
        {
          id: m.id,
          name: m.name,
          strength: m.strength,
          dose: m.dose,
          schedule,
          status: m.status,
          deletedAt: m.deletedAt,
          createdAt: m.createdAt,
          startedOn: m.startedOn,
          stoppedOn: m.stoppedOn,
        },
      ];
    });

    const plan = planAhead({ medications, passes: passes.data, from, days: dayCount, timeZone });
    const days = plan.days.map((d) => ({
      day: d.day,
      weekday: weekdayOf(d.day),
      rounds: d.rounds.map((r) => ({
        name: r.name ?? (r.medications[0] ? medicationTitle(r.medications[0].medication) : r.time),
        time: r.time,
        at: zonedIso(r.at, timeZone),
        medications: r.medications.map((m) => ({
          medicationId: m.medication.id,
          medication: medicationTitle(m.medication),
          amount: m.amount,
        })),
      })),
    }));
    const asNeeded = plan.asNeeded.map((a) => ({
      medicationId: a.medication.id,
      medication: medicationTitle(a.medication),
      maxPerDay: a.max,
    }));

    // Consecutive days with the same rounds are written once, as a range.
    const roundLines = (d: (typeof days)[number]) =>
      d.rounds.length
        ? d.rounds.map(
            (r) =>
              `  ${r.name} (${r.time}): ${r.medications.map((m) => `${m.medication}${m.amount ? `, ${m.amount}` : ""}`).join("; ")}`,
          )
        : ["  No scheduled doses"];
    const runs: { first: (typeof days)[number]; last: (typeof days)[number]; lines: string[] }[] = [];
    for (const d of days) {
      const lines = roundLines(d);
      const prev = runs.at(-1);
      if (prev && prev.lines.join("\n") === lines.join("\n")) prev.last = d;
      else runs.push({ first: d, last: d, lines });
    }
    const dayName = (d: (typeof days)[number]) => `${d.weekday} ${d.day}`;
    const text = [
      `Dose schedule (${timeZone}):`,
      ...runs.flatMap((run) => [
        `${dayName(run.first)}${run.last === run.first ? "" : ` to ${dayName(run.last)}`}:`,
        ...run.lines,
      ]),
      ...(asNeeded.length
        ? [
            `As needed: ${asNeeded
              .map((a) => `${a.medication}${a.maxPerDay ? ` (at most ${a.maxPerDay} a day)` : ""}`)
              .join("; ")}.`,
          ]
        : []),
    ].join("\n");
    return { text, structured: { timeZone, from, days, asNeeded } };
  },
});
