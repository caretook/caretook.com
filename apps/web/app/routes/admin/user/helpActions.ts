// The help actions on an account's page (admin PRD, slice 2): what each is
// called, what its dialog says, and what the page says once it's done.
// Every one takes a reason. Pure, tested.

export const HELP_INTENTS = [
  "resendVerification",
  "sendReset",
  "revokeSession",
  "revokeAllSessions",
] as const;
export type HelpIntent = (typeof HELP_INTENTS)[number];

export const isHelpIntent = (value: unknown): value is HelpIntent => HELP_INTENTS.some((i) => i === value);

export type HelpRequest = { intent: HelpIntent; reason: string; sessionId?: string };

/** The posted form as a help request, or null when its intent is unknown. */
export const parseHelpForm = (form: FormData): HelpRequest | null => {
  const text = (name: string) => {
    const value = form.get(name);
    return typeof value === "string" ? value.trim() : "";
  };
  const intent = text("intent");
  if (!isHelpIntent(intent)) return null;
  const sessionId = text("sessionId");
  return {
    intent,
    reason: text("reason"),
    ...(intent === "revokeSession" && sessionId ? { sessionId } : {}),
  };
};

/** What the page says after `intent` went through. */
export const helpDoneMessage = (intent: HelpIntent, revoked?: number) => {
  switch (intent) {
    case "resendVerification":
      return "A new confirmation email is on its way.";
    case "sendReset":
      return "A password reset email is on its way.";
    case "revokeSession":
      return "That session is signed out.";
    case "revokeAllSessions":
      return revoked === 1
        ? "Signed out of 1 session."
        : `Signed out of ${(revoked ?? 0).toLocaleString("en-US")} sessions.`;
  }
};

/** An action's button, dialog title, explanation and confirm button. */
export type ActionCopy = { button: string; title: string; message: string; confirm: string };

/** Each help action's words. */
export const HELP_COPY: Record<HelpIntent, ActionCopy> = {
  resendVerification: {
    button: "Resend confirmation email",
    title: "Resend the confirmation email?",
    message: "They get a new link to confirm their address. Earlier links keep working until they expire.",
    confirm: "Send it",
  },
  sendReset: {
    button: "Send password reset",
    title: "Send a password reset?",
    message:
      "They get a link to choose a new password, good for an hour. Their password stays until they use it.",
    confirm: "Send it",
  },
  revokeSession: {
    button: "Sign out",
    title: "Sign this session out?",
    message: "That device's next request goes to sign-in. Its sync can last up to 15 more minutes.",
    confirm: "Sign out",
  },
  revokeAllSessions: {
    button: "Sign out everywhere",
    title: "Sign out every session?",
    message: "Every device's next request goes to sign-in. Their sync can last up to 15 more minutes.",
    confirm: "Sign out everywhere",
  },
};
