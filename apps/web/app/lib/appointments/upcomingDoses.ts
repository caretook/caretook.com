import type { DueDoses, SlotState } from "../medications/dueDoses";
import type { PassLike } from "@caretook/data/schema";
import type { TimedEntry } from "./upcoming";
import type { UpcomingSection } from "./upcomingDays";

import { localDate } from "@caretook/data/schema";
import { duePasses } from "../medications/duePasses";
import { dayLabel } from "../core/format";
import { medicationCountText, passTitle } from "../medications/medicationDisplay";
import { NOW_KEY } from "./upcomingDays";

// Today's medication doses in Upcoming, by pass (`duePasses`): a pass that
// still wants doses (upcoming, due or overdue, partly done or not) is one
// item, and a time of its own one item for its medication, under their day,
// in time order among the appointments and reminders. Worked out, never
// written: a logged dose answers its slot, and once a pass is done it drops
// out. Pure; web:unit tests it.

/** One open pass, or one medication's open time of its own, as an Upcoming item. */
export type UpcomingDose = {
  type: "dueDose";
  /** `pass:<passId>`, or `<medicationId>@HH:MM`: unique for the day. */
  key: string;
  /** The pass, or null for a time of its own. */
  passId: string | null;
  /** A time of its own's medication, or null for a pass. */
  medicationId: string | null;
  /** The pass's name ("Morning"), or the medication ("Metformin 500 mg"). */
  title: string;
  /** How many medications in it still want a dose. */
  count: number;
  /** The schedule time, "HH:MM" in the recipient's zone (the Dose sheet's `?slot=`). */
  time: string;
  /** The moment it falls (ISO 8601). */
  at: string;
  state: Extract<SlotState, "upcoming" | "due" | "overdue">;
};

/** Anything Upcoming lists: an entry, or a dose slot. */
export type WithDoses<T> = T | UpcomingDose;

export const isUpcomingDose = <T extends object>(item: WithDoses<T>): item is UpcomingDose =>
  "type" in item && item.type === "dueDose";

/** Today's passes that still want a dose, in time order (as `duePasses` gives them). */
export const upcomingDoses = (
  due: Pick<DueDoses, "slots">,
  passes: readonly Pick<PassLike, "id" | "name" | "sortOrder">[] = [],
): UpcomingDose[] =>
  duePasses(due, passes)
    .filter((pass) => pass.state !== "done")
    .map((pass) => ({
      type: "dueDose",
      key: pass.key,
      passId: pass.name ? pass.passId : null,
      medicationId: pass.name ? null : (pass.open[0]?.medication.id ?? null),
      title: passTitle(pass),
      count: pass.open.length,
      time: pass.time,
      at: pass.at,
      state: pass.state as UpcomingDose["state"],
    }));

/** What an item reads as: "Metformin 500 mg dose", "Morning · 3 medications". */
export const doseItemText = (dose: Pick<UpcomingDose, "passId" | "title" | "count">) =>
  dose.passId ? `${dose.title} · ${medicationCountText(dose.count)}` : `${dose.title} dose`;

/**
 * Whether doses show with these filters: only unfiltered. A kind filter is a
 * note or event kind, and an open slot has no author.
 */
export const showsDoses = ({ kind, author }: { kind?: string | null; author?: string | null }) =>
  !kind && !author;

/** A dose's state as it reads in Upcoming: "Due", "Overdue", or nothing while it's later. */
export const doseStateLabel = (state: UpcomingDose["state"]) =>
  state === "due" ? "Due" : state === "overdue" ? "Overdue" : null;

/** "Log Metformin 500 mg, 8:00 PM dose, overdue", "Log Morning, 8:00 AM, 3 medications, due": a writer's link. */
export const doseLinkLabel = (dose: UpcomingDose, when: string) => {
  const state = doseStateLabel(dose.state);
  const what = dose.passId
    ? `${dose.title}, ${when}, ${medicationCountText(dose.count)}`
    : `${dose.title}, ${when} dose`;
  return `Log ${what}${state ? `, ${state.toLowerCase()}` : ""}`;
};

const ms = (iso: string) => new Date(iso).getTime();

/** Where a dose sits in a day: after the all-day items, by time; on a tie, after the entry. */
const goesBefore = (dose: UpcomingDose, item: TimedEntry) =>
  !item.allDay && ms(dose.at) < ms(item.occurredAt);

/**
 * Upcoming's sections (`upcomingSections`) with `doses` in them. A dose is
 * listed under its day where the viewer is, and a due or overdue one (its
 * time already past) under today; never under "Now", which is for
 * appointments in progress. A day with only doses gets its own section, in
 * day order.
 */
export function withDueDoses<T extends TimedEntry>(
  sections: readonly UpcomingSection<T>[],
  doses: readonly UpcomingDose[],
  now: Date,
  viewerZone: string,
  locale?: string,
): UpcomingSection<WithDoses<T>>[] {
  const out: UpcomingSection<WithDoses<T>>[] = sections.map((s) => ({ ...s, items: [...s.items] }));
  const nowIso = now.toISOString();
  for (const dose of doses) {
    const when = ms(dose.at) > now.getTime() ? dose.at : nowIso;
    const key = localDate(when, viewerZone);
    let section = out.find((s) => s.key === key);
    if (!section) {
      section = { key, label: dayLabel(when, viewerZone, now, locale), items: [] };
      const at = out.findIndex((s) => s.key !== NOW_KEY && s.key > key);
      if (at === -1) out.push(section);
      else out.splice(at, 0, section);
    }
    const items = section.items;
    const index = items.findIndex((item) =>
      isUpcomingDose(item) ? ms(dose.at) < ms(item.at) : goesBefore(dose, item),
    );
    if (index === -1) items.push(dose);
    else items.splice(index, 0, dose);
  }
  return out;
}
