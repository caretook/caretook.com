// The pure parts of `/join/:code`: what a code that can't be used says.
// Plain words, and nothing about who made the code or how often it was used.

export type CodePreview =
  | { state: "usable"; code: string }
  | { state: "notFound" | "expired" | "revoked" | "usedUp" | "unavailable" };

export const CLOSED_CODE: Record<
  Exclude<CodePreview["state"], "usable">,
  { title: string; message: string }
> = {
  notFound: {
    title: "This code isn't valid",
    message: "Check the code and try again, or ask whoever gave it to you for a new one.",
  },
  expired: {
    title: "This code has expired",
    message: "Ask whoever gave it to you for a new one.",
  },
  revoked: {
    title: "This code no longer works",
    message: "It was withdrawn. Ask whoever gave it to you for a new one.",
  },
  usedUp: {
    title: "This code has been used up",
    message: "It's been used as many times as it allows. Ask whoever gave it to you for a new one.",
  },
  // Access-code sign-up is switched off for now (admin settings).
  unavailable: {
    title: "Not available right now",
    message: "Starting a care group with a code isn't available right now. Try again later.",
  },
};

/** The two steps of the form: your account, then who you care for. */
export const JOIN_STEPS = ["account", "recipient"] as const;
export type JoinStep = (typeof JOIN_STEPS)[number];

/** Fields of each step, so a refused sign-up opens the step with the problem. */
const RECIPIENT_FIELDS = ["group.recipientName", "group.preferredName", "group.groupName", "recipientName"];
export const stepForIssues = (paths: string[]): JoinStep =>
  paths.some((p) => RECIPIENT_FIELDS.includes(p)) ? "recipient" : "account";
