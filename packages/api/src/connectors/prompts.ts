import type { ConnectorScope } from "@caretook/data";

import { z } from "zod";

// The connector prompts (connectors-2 PRD): ready-made starting points the
// assistant lists for the member (MCP's `prompts/list` and `prompts/get`).
// Each one is a name, a title and description the client shows, the scope
// it needs (logging needs write), its arguments as a Zod object of strings
// (MCP prompt arguments are strings), and a function that renders the user
// message: what to do and which tools to use. Prompts read nothing
// themselves; the model calls the tools.

/** Arguments are a flat object of (optional) strings: MCP sends each as a string. */
type PromptArgs = z.ZodObject<Record<string, z.ZodType<string | undefined>>>;

export type Prompt<A extends PromptArgs = PromptArgs> = {
  name: string;
  title: string;
  description: string;
  /** `read` prompts are listed for every grant; `readWrite` ones only for a grant that may write. */
  scope: ConnectorScope;
  args: A;
  render: (args: z.output<A>) => string;
};

/** Keeps a prompt's argument types through to its render function. */
export const definePrompt = <A extends PromptArgs>(prompt: Prompt<A>): Prompt => prompt;

/** Whether a grant of `scope` may see and get `prompt`. */
export const promptAllowed = (prompt: Pick<Prompt, "scope">, scope: ConnectorScope) =>
  prompt.scope === "read" || scope === "readWrite";

/** MCP's argument list for a prompt: each field's name, description and whether it's required. */
export const promptArguments = (args: PromptArgs) => {
  const schema = z.toJSONSchema(args, { io: "input" }) as {
    properties?: Record<string, { description?: string }>;
    required?: string[];
  };
  return Object.entries(schema.properties ?? {}).map(([name, field]) => ({
    name,
    ...(field.description ? { description: field.description } : {}),
    required: schema.required?.includes(name) ?? false,
  }));
};

/** `prompts/list`'s entry for a prompt. */
export const describePrompt = (prompt: Prompt) => ({
  name: prompt.name,
  title: prompt.title,
  description: prompt.description,
  arguments: promptArguments(prompt.args),
});

/** A free-text argument: trimmed, empty counts as not given. */
const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => value || undefined);

const START = "Start with group_overview for the care group's time zone and today's date there.";

export const catchMeUp = definePrompt({
  name: "catch_me_up",
  title: "Catch me up",
  description: "What happened since a time (today by default): the timeline, doses due and what's coming.",
  scope: "read",
  args: z.object({
    since: text(100)
      .optional()
      .describe('Since when, such as "yesterday at 6pm" or an ISO 8601 time. Default: the start of today.'),
  }),
  render: ({ since }) =>
    [
      `Catch me up on the care group since ${since ? `"${since}"` : "the start of today"}, in the care recipient's time zone.`,
      START,
      "Then use list_timeline with `from` set to that time for what was logged and by whom, todays_doses for the doses given, missed or still due today, and upcoming for what's coming in the next few days.",
      "Answer in a few short sections, most important first. If nothing was logged, say so plainly.",
    ].join("\n\n"),
});

export const prepareForAppointment = definePrompt({
  name: "prepare_for_appointment",
  title: "Prepare for an appointment",
  description:
    "Recent symptoms, vitals and medication changes for an upcoming appointment, and questions to ask.",
  scope: "read",
  args: z.object({
    appointment: text(200)
      .optional()
      .describe("Which appointment: its title or date. Default: the next one."),
  }),
  render: ({ appointment }) =>
    [
      `Help me prepare for ${appointment ? `the appointment "${appointment}"` : "the next appointment"}.`,
      START,
      `Find it with upcoming${appointment ? " (or search, if it isn't in the next few weeks)" : ""}, and note who it's with.`,
      "Then gather what has happened since the last visit with that provider, or the last 30 days: list_timeline with kinds symptom, vital, medicationChange and conditionChange, latest_vitals, list_medications, and recipient_profile for the conditions and allergies.",
      "Summarize it briefly for the visit, then draft a short list of questions to ask. Don't give medical advice; leave that to the clinician.",
    ].join("\n\n"),
});

export const weeklySummary = definePrompt({
  name: "weekly_summary",
  title: "Weekly summary",
  description: "A plain-language summary of the last 7 days, to share with family.",
  scope: "read",
  args: z.object({}),
  render: () =>
    [
      "Write a plain-language summary of the last 7 days of care, to share with family.",
      START,
      "Then use list_timeline from 7 days ago (pass nextCursor back until there are no more), latest_vitals, list_medications for anything that changed, and upcoming for the week ahead.",
      "Keep it short and warm, with no medical jargon. Leave out phone numbers, addresses and anything the family wouldn't need.",
    ].join("\n\n"),
});

export const logWhatHappened = definePrompt({
  name: "log_what_happened",
  title: "Log what happened",
  description: "Describe the day and have it logged as vitals, doses, symptoms and notes, each confirmed.",
  scope: "readWrite",
  args: z.object({
    account: z
      .string()
      .trim()
      .min(1, "Say what happened")
      .max(5000)
      .describe("What happened, in your own words."),
  }),
  render: ({ account }) =>
    [
      "Log what happened in the care group from my account below.",
      START,
      "Turn it into entries: log_vitals for measurements, log_dose for medications given (check todays_doses or list_medications for the exact medication), log_symptom for symptoms, add_event for appointments, add_task for things to do, and add_note for anything else.",
      "List the entries you'll make first, then make each with its own tool call so I can confirm each one. Use the times I give, in the care recipient's time zone; if a time or a medication isn't clear, ask instead of guessing.",
      `My account:\n\n${account}`,
    ].join("\n\n"),
});

/** Every connector prompt, in the order prompts/list shows them; a new one adds a line at the end. */
export const CONNECTOR_PROMPTS: readonly Prompt[] = [
  catchMeUp,
  prepareForAppointment,
  weeklySummary,
  logWhatHappened,
];
