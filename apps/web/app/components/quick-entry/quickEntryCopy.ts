/** The still prompt in the empty box. */
export const QUICK_ENTRY_PLACEHOLDER = "Type what happened…";

/** Example lines, each with what it makes (the ? popover lists them). */
export const QUICK_ENTRY_EXAMPLES = [
  { line: "bp 130/85 hr 72", makes: "Vitals: blood pressure and heart rate" },
  { line: "gave metformin", makes: "A dose of that medication" },
  { line: "pain 4 left knee", makes: "A symptom" },
  { line: "appt Dr Lee Friday 2pm", makes: "An appointment" },
  { line: "n: slept well", makes: "A note (start a part with n:)" },
] as const;

/** The full rules, for the box's accessible description. */
export const QUICK_ENTRY_RULES =
  "Commas separate entries. Start a part with “n:” for a note. Examples: bp 130/85 hr 72, gave metformin, pain 4 left knee, appt Dr Lee Friday 2pm.";
