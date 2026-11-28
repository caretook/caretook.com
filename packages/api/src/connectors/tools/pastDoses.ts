import type { DoseSlot, DueDose, DueMedication } from "@caretook/data";

import {
  clockAt,
  doseRecord,
  isError,
  medicationPassService,
  medicationService,
  medicationTitle,
  newError,
  normalizeSchedule,
  slotStateText,
  timelineEntryService,
} from "@caretook/data";
import { z } from "zod";
import { defineTool, READ_ANNOTATIONS } from "../registry";
import { zonedIso } from "../time";
import { DAY_MS, entriesBetween, LIST_PAGE_MAX } from "./readSupport";
import { asMember, loadGroup, loadMembers } from "./shared";
import { addDays, dayInZone, startOfDay } from "@caretook/data/domain";

/** `past_doses` reads this many days by default (ending today), and at most MAX. */
export const PAST_DOSES_DEFAULT_DAYS = 7;
export const PAST_DOSES_MAX_DAYS = 14;
/** How far back `from` may reach, in days before today. */
export const PAST_DOSES_MAX_DAYS_BACK = 90;

/** What a `from` after today is answered with: the days ahead are the plan's. */
export const FUTURE_RECORD_REFUSAL = "Past doses end today. Use dose_schedule for the days ahead.";
export const TOO_FAR_BACK_REFUSAL = `At most ${PAST_DOSES_MAX_DAYS_BACK} days back.`;
/** `past_doses` reads at most this many pages of doses (of LIST_PAGE_MAX). */
export const PAST_DOSES_MAX_PAGES = 40;
/** What a window with more doses than those pages hold is answered with. */
export const TOO_BUSY_REFUSAL = "Too many doses in that range to read them all. Ask for fewer days.";

const input = z.object({
  from: z.iso
    .date()
    .optional()
    .describe(
      `The first day, YYYY-MM-DD in the care recipient's time zone (default ${PAST_DOSES_DEFAULT_DAYS - 1} days before today; not after today, at most ${PAST_DOSES_MAX_DAYS_BACK} days back).`,
    ),
  days: z
    .int()
    .min(1)
    .max(PAST_DOSES_MAX_DAYS)
    .optional()
    .describe(
      `How many days from \`from\` (at most ${PAST_DOSES_MAX_DAYS}; default ${PAST_DOSES_DEFAULT_DAYS}); days after today are left out.`,
    ),
});

/** "Friday", for a "YYYY-MM-DD" day. */
const weekdayOf = (day: string) =>
  new Date(`${day}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" });

/** Whole days from `a` to `b`, both "YYYY-MM-DD". */
const daysBetween = (a: string, b: string) =>
  Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY_MS);

/** One slot as the assistant sees it, in the recipient's zone (`todays_doses`' fields). */
const toSlot = (slot: DoseSlot, timeZone: string, who: Map<string, string | null>) => ({
  medicationId: slot.medication.id,
  medication: medicationTitle(slot.medication),
  amount: slot.amount,
  time: slot.time,
  at: zonedIso(slot.at, timeZone),
  state: slot.state,
  dose: slot.dose
    ? {
        entryId: slot.dose.id,
        status: slot.dose.details.status,
        loggedAt: zonedIso(slot.dose.occurredAt, timeZone),
        loggedBy: slot.dose.createdBy ? (who.get(slot.dose.createdBy) ?? null) : null,
      }
    : null,
});

const STATUS_WORD = { given: "Given", skipped: "Skipped", refused: "Refused" } as const;

/** A slot's state as the text reads it: "Given by Sam at 8:12", "Missed", "Due". */
const stateLine = (slot: DoseSlot, loggedBy: string | null, timeZone: string) =>
  slot.dose
    ? `${STATUS_WORD[slot.dose.details.status]}${loggedBy ? ` by ${loggedBy}` : ""} at ${clockAt(slot.dose.occurredAt, timeZone)}`
    : slotStateText(slot, timeZone);

/**
 * The past days' medication rounds with each slot's state and the dose that
 * answered it, from the due-dose core (`doseRecord`): the shape of the
 * printed weekly sheet, for checking it against the app.
 */
export const pastDoses = defineTool({
  name: "past_doses",
  title: "Past doses",
  description: `Past days' medication doses with their states, in the care recipient's day, for checking a week or a paper dose sheet against the app: for each day, each med time (such as Morning) or medication's own time with its medications, and each scheduled dose's state (given, skipped, refused, missed; today's later ones upcoming, due or overdue) with who logged it and when. log_past_doses names a dose by its medicationId, day and time as listed here. Today's live state is todays_doses'; the days ahead are dose_schedule's. The ${PAST_DOSES_DEFAULT_DAYS} days ending today by default, at most ${PAST_DOSES_MAX_DAYS}, at most ${PAST_DOSES_MAX_DAYS_BACK} days back.`,
  scope: "read",
  input,
  annotations: READ_ANNOTATIONS,
  handler: async (args, ctx) => {
    const loaded = await loadGroup(ctx);
    if (isError(loaded)) return loaded;
    const { timeZone } = loaded;
    const today = dayInZone(ctx.now, timeZone);
    const from = args.from ?? addDays(today, -(PAST_DOSES_DEFAULT_DAYS - 1));
    const refuse = (message: string) =>
      newError({ code: "connectorTool:invalid", meta: { issues: [{ path: "from", message }] } });
    if (from > today) return refuse(FUTURE_RECORD_REFUSAL);
    if (from < addDays(today, -PAST_DOSES_MAX_DAYS_BACK)) return refuse(TOO_FAR_BACK_REFUSAL);
    // Days after today are left out.
    const dayCount = Math.min(args.days ?? PAST_DOSES_DEFAULT_DAYS, daysBetween(from, today) + 1);
    const to = addDays(from, dayCount - 1);

    const members = await loadMembers(ctx);
    if (isError(members)) return members;
    const who = new Map(members.map((m) => [m.id, m.name]));
    // Current and stopped, not deleted: a stopped one counts up to its stop day.
    const meds = await medicationService.list(asMember(ctx), { groupId: ctx.groupId });
    if (isError(meds)) return meds;
    const passes = await medicationPassService.list(asMember(ctx), {
      groupId: ctx.groupId,
      includeDeleted: true,
    });
    if (isError(passes)) return passes;
    // Doses from the day before `from` to the day after `to`, so one near
    // either midnight keeps its own slot, and only the window is read.
    const entries = await entriesBetween(
      ctx,
      {
        kinds: ["dose"],
        from: startOfDay(addDays(from, -1), timeZone).toISOString(),
        to: startOfDay(addDays(to, 2), timeZone).toISOString(),
      },
      PAST_DOSES_MAX_PAGES,
    );
    if (isError(entries)) return entries;
    // A full last page may have more behind it: doses never read would show as missed.
    if (entries.length >= PAST_DOSES_MAX_PAGES * LIST_PAGE_MAX)
      return newError({
        code: "connectorTool:invalid",
        meta: { issues: [{ path: "days", message: TOO_BUSY_REFUSAL }] },
      });
    // The schedule each day had, from the first day the matching reaches.
    const changes = await timelineEntryService.scheduleChanges(asMember(ctx), {
      groupId: ctx.groupId,
      from: startOfDay(addDays(from, -2), timeZone).toISOString(),
    });
    if (isError(changes)) return changes;

    const medications = meds.data.flatMap((m): DueMedication[] => {
      const schedule = normalizeSchedule(m.schedule);
      if (!schedule) return [];
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
    const doses = entries.flatMap((e): DueDose[] => {
      const details = e.details as DueDose["details"] | null;
      if (!details?.medicationId) return [];
      return [{ id: e.id, occurredAt: e.occurredAt, details, createdBy: e.createdBy }];
    });

    const record = doseRecord({
      medications,
      passes: passes.data,
      doses,
      changes,
      from,
      days: dayCount,
      now: ctx.now,
      timeZone,
    });
    const days = record.days.map((d) => ({
      day: d.day,
      weekday: weekdayOf(d.day),
      rounds: d.rounds.map((r) => ({
        // The med time's id; null for a medication's own time.
        passId: r.passId,
        name: r.name ?? (r.slots[0] ? medicationTitle(r.slots[0].medication) : r.time),
        time: r.time,
        slots: r.slots.map((s) => toSlot(s, timeZone, who)),
      })),
    }));

    const text = [
      `Past doses, ${from} to ${to} (${timeZone}):`,
      ...record.days.flatMap((d, i) => [
        `${days[i]!.weekday} ${d.day}:`,
        ...(d.rounds.length
          ? d.rounds.map(
              (r, j) =>
                `  ${days[i]!.rounds[j]!.name} (${r.time}): ${r.slots
                  .map((s, k) => {
                    const out = days[i]!.rounds[j]!.slots[k]!;
                    return `${out.medication}${out.amount ? `, ${out.amount}` : ""}: ${stateLine(s, out.dose?.loggedBy ?? null, timeZone)}`;
                  })
                  .join("; ")}`,
            )
          : ["  No scheduled doses"]),
      ]),
    ].join("\n");
    return { text, structured: { timeZone, from, to, days } };
  },
});
