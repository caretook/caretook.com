import type { SheetDoseMark } from "@caretook/data";

import {
  assistantActionService,
  isError,
  medicationPassService,
  medicationService,
  medicationTitle,
  SHEET_DOSE_MARKS_MAX,
  sheetDoseMarkZSchema,
} from "@caretook/data";
import { z } from "zod";
import { linkTo, timelinePath } from "../links";
import { defineTool, WRITE_ANNOTATIONS } from "../registry";
import { asMember, loadMembers } from "./shared";

// log_past_doses (connectors-3): a member's assistant logs a photographed
// week of the paper dose sheet in one call, through
// `assistantActionService.logPastDoses` with `via` the client's name. Open
// slots are added at their scheduled times in their rounds; every other mark
// is reported (already logged, a conflict to ask about, or not logged with
// its reason), and nothing already logged is ever changed.

const mark = sheetDoseMarkZSchema.shape;
const input = z.object({
  marks: z
    .array(
      z.object({
        medicationId: mark.medicationId.describe("The medication's id, as past_doses lists it."),
        day: mark.day.describe("The care recipient's day, YYYY-MM-DD, as past_doses lists it."),
        time: mark.time.describe('The scheduled time, "HH:MM", as past_doses lists it (such as "08:00").'),
        status: mark.status.describe("What the sheet's box says: given, skipped or refused."),
        note: mark.note.describe("A note written beside the box, if any."),
      }),
    )
    .min(1)
    .max(SHEET_DOSE_MARKS_MAX)
    .describe(`The sheet's marked boxes, at most ${SHEET_DOSE_MARKS_MAX}; leave blank boxes out.`),
});

type Outcome = Awaited<ReturnType<typeof assistantActionService.logPastDoses>>;

/** Why a mark wasn't logged, in the answer's words. */
const NOT_LOGGED = {
  noSlot: "no scheduled dose of it then (check past_doses for that day's times)",
  notYet: "that dose's time hasn't come yet",
  tooOld: "more than 14 days back (log it in the app)",
  repeated: "the same dose is marked twice on the sheet; only the first mark counts",
} as const;

/** "Tue Nov 24", for a "YYYY-MM-DD" day. */
const dayLabel = (day: string) => {
  const at = new Date(`${day}T12:00:00Z`);
  const part = (o: Intl.DateTimeFormatOptions) => at.toLocaleDateString("en-US", { ...o, timeZone: "UTC" });
  return `${part({ weekday: "short" })} ${part({ month: "short" })} ${part({ day: "numeric" })}`;
};

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export const logPastDoses = defineTool({
  name: "log_past_doses",
  title: "Log past doses",
  description: `Log many past scheduled medication doses at once, such as a paper dose sheet or a past week: each marked box as given, skipped or refused. Read past_doses first and name each dose by its medicationId, day and time as it lists them. Only given, skipped or refused marks (leave blank boxes out); at most ${SHEET_DOSE_MARKS_MAX}, from the last 14 days. As-needed doses aren't on the schedule: use log_dose with their time. Open doses are added at their scheduled times; one already logged the same is left alone, and one the app has with another answer is a conflict that is never changed: ask the member, who fixes it in the app. Ask the member before calling.`,
  scope: "readWrite",
  input,
  annotations: WRITE_ANNOTATIONS,
  handler: async (args, ctx) => {
    const res: Outcome = await assistantActionService.logPastDoses(asMember(ctx), ctx.groupId, args.marks, {
      via: ctx.clientName,
      now: ctx.now,
    });
    if (isError(res)) return res;

    // Names for the answer's lines: the medications (deleted too), the med times and members.
    const meds = await medicationService.list(asMember(ctx), { groupId: ctx.groupId, includeDeleted: true });
    if (isError(meds)) return meds;
    const passes = await medicationPassService.list(asMember(ctx), {
      groupId: ctx.groupId,
      includeDeleted: true,
    });
    if (isError(passes)) return passes;
    const members = await loadMembers(ctx);
    if (isError(members)) return members;
    const medName = new Map(meds.data.map((m) => [m.id, medicationTitle(m)]));
    const passName = new Map(passes.data.map((p) => [p.id, p.name]));
    const who = new Map(members.map((m) => [m.id, m.name]));

    const marks: SheetDoseMark[] = args.marks;
    const results = res.results.map((r, i) => ({
      outcome: r.outcome,
      mark: marks[i]!,
      entryId: r.entryId ?? null,
      ...(r.recorded && {
        recorded: {
          status: r.recorded.status,
          loggedBy: r.recorded.loggedBy ? (who.get(r.recorded.loggedBy) ?? null) : null,
        },
      }),
      passId: r.passId,
    }));
    /** "Tue Nov 24 Evening, Metformin 500 mg". */
    const slotName = ({ mark: m, passId }: (typeof results)[number]) =>
      `${dayLabel(m.day)} ${(passId && passName.get(passId)) || m.time}, ${medName.get(m.medicationId) ?? "an unknown medication"}`;

    const count = (outcome: string) => results.filter((r) => r.outcome === outcome).length;
    const added = count("add");
    const already = count("alreadyLogged");
    const conflicts = results.filter((r) => r.outcome === "conflict");
    const notLogged = results.filter((r) => r.outcome in NOT_LOGGED);
    const counts = [
      added ? `Added ${plural(added, "dose", "doses")}` : "Nothing added",
      ...(already ? [`${already} already logged`] : []),
      ...(conflicts.length ? [`${conflicts.length} to check`] : []),
      ...(notLogged.length ? [`${notLogged.length} not logged`] : []),
    ].join(", ");
    const url = linkTo(ctx.origin, timelinePath(ctx.groupId));
    const text = [
      `${counts}.`,
      ...conflicts.map(
        (r) =>
          `${slotName(r)}: the sheet says ${r.mark.status}, the app says ${r.recorded!.status}${r.recorded!.loggedBy ? ` (logged by ${r.recorded!.loggedBy})` : ""}. Ask the member; it can be changed in the app.`,
      ),
      ...notLogged.map(
        (r) => `${slotName(r)}: not logged, ${NOT_LOGGED[r.outcome as keyof typeof NOT_LOGGED]}.`,
      ),
      url,
      ...(added ? [`Shown as "via ${ctx.clientName}".`] : []),
    ].join("\n");
    return {
      text,
      structured: {
        results: results.map(({ passId: _passId, ...r }) => r),
        added,
        url,
        via: ctx.clientName,
      },
    };
  },
});
