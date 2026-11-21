// /connect's success step (connectors-2 PRD): what the member sees after
// Connect, before they go back to their assistant. Pure and client safe.

/** How long the success step stays before returning to the assistant on its own. */
export const CONNECT_RETURN_DELAY_MS = 5000;

/** Three things to ask first: reads, so they work for a viewer's connection too. */
export const CONNECT_SUCCESS_EXAMPLES = [
  "Catch me up on today.",
  "What doses are still due today?",
  "What’s coming up this week?",
] as const;

export const connectedTitle = (groupName: string) => `Connected to ${groupName}`;

export const returnLabel = (clientName: string) => `Return to ${clientName}`;

/** The line under the examples: where the member goes, and that it happens on its own. */
export const returningNote = (clientName: string, delayMs = CONNECT_RETURN_DELAY_MS) =>
  `Taking you back to ${clientName} in ${Math.round(delayMs / 1000)} seconds.`;
