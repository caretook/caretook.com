import type { DueDose, DueMedication } from "@caretook/data";

import {
  addDays,
  dayInZone,
  doseText,
  dueDoses,
  duePasses,
  isError,
  medicationPassService,
  medicationService,
  medicationTitle,
  normalizeSchedule,
  passTitle,
  slotStateText,
  startOfDay,
} from "@caretook/data";
import { z } from "zod";
import { defineTool, READ_ANNOTATIONS } from "../registry";
import { zonedIso } from "../time";
import { entriesBetween } from "./readSupport";
import { asMember, loadGroup, loadMembers } from "./shared";

/** One slot as the assistant sees it, in the recipient's zone. */
const toSlot = (
  slot: ReturnType<typeof dueDoses>["slots"][number],
  timeZone: string,
  who: Map<string, string | null>,
) => ({
  medicationId: slot.medication.id,
  medication: medicationTitle(slot.medication),
  amount: slot.amount,
  time: slot.time,
  at: zonedIso(slot.at, timeZone),
  state: slot.state,
  status: slotStateText(slot, timeZone),
  dose: slot.dose
    ? {
        entryId: slot.dose.id,
        status: slot.dose.details.status,
        loggedAt: zonedIso(slot.dose.occurredAt, timeZone),
        loggedBy: slot.dose.createdBy ? (who.get(slot.dose.createdBy) ?? null) : null,
      }
    : null,
});

/**
 * Today's medication rounds in the recipient's zone, from the same core the
 * app's Today uses: each pass with its slots and their state (upcoming, due,
 * overdue, given, skipped, refused), yesterday's missed doses, and the
 * as-needed medications' counts so far.
 */
export const todaysDoses = defineTool({
  name: "todays_doses",
  title: "Today's doses",
  description:
    "Today's medication doses in the care recipient's day, as the app's Today shows them: each round (pass) or time with its medications and their state (upcoming, due, overdue, given, skipped, refused), who logged the answered ones, yesterday's missed doses, and as-needed medications with today's count against their maximum.",
  scope: "read",
  input: z.object({}),
  annotations: READ_ANNOTATIONS,
  handler: async (_input, ctx) => {
    const loaded = await loadGroup(ctx);
    if (isError(loaded)) return loaded;
    const { timeZone } = loaded;
    const members = await loadMembers(ctx);
    if (isError(members)) return members;
    const who = new Map(members.map((m) => [m.id, m.name]));

    const meds = await medicationService.list(asMember(ctx), { groupId: ctx.groupId });
    if (isError(meds)) return meds;
    const passes = await medicationPassService.list(asMember(ctx), {
      groupId: ctx.groupId,
      includeDeleted: true,
    });
    if (isError(passes)) return passes;

    // Doses since yesterday began in the recipient's zone: what the core reads.
    const from = startOfDay(addDays(dayInZone(ctx.now, timeZone), -1), timeZone).toISOString();
    const entries = await entriesBetween(ctx, { kinds: ["dose"], from });
    if (isError(entries)) return entries;

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
    const doses = entries.flatMap((e): DueDose[] => {
      const details = e.details as DueDose["details"] | null;
      if (!details?.medicationId) return [];
      return [{ id: e.id, occurredAt: e.occurredAt, details, createdBy: e.createdBy }];
    });

    const due = dueDoses({ medications, passes: passes.data, doses, now: ctx.now, timeZone });
    const rounds = duePasses(due, passes.data).map((pass) => ({
      name: passTitle(pass),
      time: pass.time,
      at: zonedIso(pass.at, timeZone),
      state: pass.state,
      slots: pass.slots.map((slot) => toSlot(slot, timeZone, who)),
    }));
    const missed = due.missed.map((slot) => toSlot(slot, timeZone, who));
    const asNeeded = due.asNeeded.map((a) => ({
      medicationId: a.medication.id,
      medication: medicationTitle(a.medication),
      countToday: a.count,
      maxPerDay: a.max,
      left: a.left,
    }));

    const roundLine = (r: (typeof rounds)[number]) =>
      [
        `${r.name ?? r.time} (${r.time}, ${r.state}):`,
        ...r.slots.map(
          (s) =>
            `  - ${s.medication}${s.amount ? `, ${s.amount}` : ""}: ${s.dose ? `${doseText({ status: s.dose.status, amount: s.amount })} at ${s.dose.loggedAt}` : s.status}`,
        ),
      ].join("\n");
    const text = [
      `Today, ${due.day} (${timeZone}):`,
      ...(rounds.length ? rounds.map(roundLine) : ["No scheduled doses today."]),
      ...(missed.length
        ? [`Missed yesterday: ${missed.map((s) => `${s.medication} at ${s.time}`).join(", ")}.`]
        : []),
      ...(asNeeded.length
        ? [
            `As needed: ${asNeeded
              .map((a) => `${a.medication} ${a.countToday}${a.maxPerDay ? ` of ${a.maxPerDay}` : ""} today`)
              .join("; ")}.`,
          ]
        : []),
    ].join("\n");
    return { text, structured: { day: due.day, timeZone, passes: rounds, missed, asNeeded } };
  },
});
