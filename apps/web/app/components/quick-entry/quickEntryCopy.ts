import type { QuickEntryMedication, QuickEntryProvider } from "@caretook/data/schema";
import type { QuickEntryCommand, QuickEntryPage } from "@caretook/data/domain";

import { jumpDayText } from "../../lib/timeline/timelineJump";

/** The still prompt in the empty box. */
export const QUICK_ENTRY_PLACEHOLDER = "Type what happened…";

/** The names the examples use when the group has none of its own (fictional). */
export const EXAMPLE_PROVIDER = "Dr Lee";
export const EXAMPLE_MEDICATION = "metformin";

/**
 * Lines to try: the tips panel lists them, and the box's description reads
 * them. They name the group's own first clinician (else its first provider)
 * and first current medication, else the fictional defaults. Each parses as
 * the kind it shows; "gave …" is a dose once the group has that medication.
 */
export function quickEntryExamples({
  providers = [],
  medications = [],
}: {
  providers?: readonly Pick<QuickEntryProvider, "name" | "type">[];
  medications?: readonly Pick<QuickEntryMedication, "name">[];
} = {}) {
  const named = <T extends { name: string }>(rows: readonly T[]) => rows.filter((r) => r.name.trim());
  const people = named(providers);
  const provider = (people.find((p) => p.type === "clinician") ?? people[0])?.name.trim();
  const medication = named(medications)[0]?.name.trim();
  return [
    "bp 130/85 hr 72",
    `gave ${medication ?? EXAMPLE_MEDICATION}`,
    "pain 4 left knee",
    `event ${provider ?? EXAMPLE_PROVIDER} Friday 2pm`,
  ] as const;
}

/** The full rules, for the box's accessible description. */
export const quickEntryRules = (examples: readonly string[]) =>
  `Commas separate entries. Start a part with “n:” for a note or “e:” for an event. Examples: ${examples.join(", ")}.`;

/** A Go to line for a day after today. */
export const GO_TO_AHEAD = "The timeline ends today.";

/** What a reader's line says instead of cards: they can view the group but not add to it. */
export const READER_REFUSAL = "You can view this care group, so nothing you type here is saved.";

/** What a command card calls each page it opens. */
export const QUICK_ENTRY_PAGE_NAMES: Record<QuickEntryPage, string> = {
  timeline: "Timeline",
  todos: "To-dos",
  planner: "Planner",
  medications: "Medications",
  medicationSchedule: "Medication schedule",
  providers: "Providers",
  carePeriods: "Care periods",
  profile: "Profile",
  allergies: "Allergies",
  settings: "Your settings",
  members: "Members",
  tags: "Tags",
  search: "Search",
};

/** The line under a command that opens in a new tab. */
export const IN_NEW_TAB = "In a new tab";

/** What a command card names: the page, or the timeline's day. */
export const commandTarget = (command: QuickEntryCommand) =>
  command.kind === "page" ? QUICK_ENTRY_PAGE_NAMES[command.page] : jumpDayText(command.day);
