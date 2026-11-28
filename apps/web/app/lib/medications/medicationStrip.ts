import type { DuePass } from "@caretook/data/schema";
import { isPassDueNow, clockTime, passTitle } from "@caretook/data/schema";

// The timeline's medication strip: one line, always there while the group has
// scheduled medications. Which pass it shows (`medicationStrip`) and what it
// says (`medicationStripText`). Pure; web:unit tests it.

/** `next`: nothing open is due yet (quiet); `due`: amber, with Given all; `overdue`: red, with Given all. */
export type StripState = "next" | "due" | "overdue";

export type MedicationStrip = {
  state: StripState;
  pass: DuePass;
  /** The next pass is tomorrow's (today's are all done): the day's first, by today's schedule. */
  tomorrow: boolean;
  /** Other passes also due or overdue now. */
  more: number;
};

/**
 * The pass the strip shows, from today's passes in time order (`duePasses`):
 * the earliest overdue one (it takes the line's place), else the earliest due
 * one, else the next upcoming one, else tomorrow's first. Null with no passes
 * today (no scheduled medications).
 */
export function medicationStrip(passes: readonly DuePass[]): MedicationStrip | null {
  if (!passes.length) return null;
  const dueNow = passes.filter(isPassDueNow);
  const pick = dueNow.find((p) => p.state === "overdue") ?? dueNow[0];
  if (pick)
    return {
      state: pick.state === "overdue" ? "overdue" : "due",
      pass: pick,
      tomorrow: false,
      more: dueNow.length - 1,
    };
  const upcoming = passes.find((p) => p.state === "upcoming");
  return { state: "next", pass: upcoming ?? passes[0]!, tomorrow: !upcoming, more: 0 };
}

/** "1 med", "4 meds". */
export const medCountText = (count: number) => `${count} med${count === 1 ? "" : "s"}`;

const LEAD: Record<StripState, string> = { next: "Next", due: "Due", overdue: "Overdue" };

/**
 * The strip's words, in parts: the lead ("Next", "Due", "Overdue"), the
 * pass's name (a link for writers), and the rest: its time in the recipient's
 * zone ("tomorrow 8:00" for tomorrow's), how many medications (those still
 * open, with "left" once some are logged; none for a medication's time of its own, which names
 * it already), and "+1 more" due. `text` is the whole line:
 * "Next: Evening · 20:00 · 4 meds", "Overdue: Morning · 8:00 · 2 meds left · +1 more".
 */
export function medicationStripText({ state, pass, tomorrow, more }: MedicationStrip) {
  const lead = LEAD[state];
  const title = passTitle(pass);
  const time = `${tomorrow ? "tomorrow " : ""}${clockTime(pass.time)}`;
  const count = !pass.name
    ? null
    : tomorrow
      ? medCountText(pass.slots.length)
      : `${medCountText(pass.open.length)}${pass.partly ? " left" : ""}`;
  const rest = [time, count, more > 0 ? `+${more} more` : null].filter(Boolean).join(" · ");
  return { lead, title, rest, text: `${lead}: ${title} · ${rest}` };
}
