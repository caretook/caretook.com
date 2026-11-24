/** The still prompt in the empty box. */
export const QUICK_ENTRY_PLACEHOLDER = "Type what happened…";

/** Lines to try: the tips panel lists them, and the box's description reads them. */
export const QUICK_ENTRY_EXAMPLES = [
  "bp 130/85 hr 72",
  "gave metformin",
  "pain 4 left knee",
  "appt Dr Lee Friday 2pm",
] as const;

/** The full rules, for the box's accessible description. */
export const QUICK_ENTRY_RULES = `Commas separate entries. Start a part with “n:” for a note or “e:” for an event. Examples: ${QUICK_ENTRY_EXAMPLES.join(", ")}.`;

/** A Go to line for a day after today. */
export const GO_TO_AHEAD = "The timeline ends today.";
