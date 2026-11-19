import { describe, expect, it } from "vitest";
import { HELP_COPY, HELP_INTENTS, helpDoneMessage, parseHelpForm } from "./helpActions";

const form = (values: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
};

describe("parseHelpForm", () => {
  it("reads the intent and the trimmed reason", () => {
    expect(parseHelpForm(form({ intent: "sendReset", reason: "  Called in  " }))).toEqual({
      intent: "sendReset",
      reason: "Called in",
    });
  });

  it("keeps a session only for signing one session out", () => {
    const sessionId = "0b6f3c1e-5d1a-4c2e-9a77-3f1d2b8c0001";
    expect(parseHelpForm(form({ intent: "revokeSession", reason: "Lost phone", sessionId }))).toEqual({
      intent: "revokeSession",
      reason: "Lost phone",
      sessionId,
    });
    expect(parseHelpForm(form({ intent: "revokeAllSessions", reason: "x", sessionId }))).toEqual({
      intent: "revokeAllSessions",
      reason: "x",
    });
  });

  it("refuses an unknown intent, and leaves an empty reason for the API to refuse", () => {
    expect(parseHelpForm(form({ intent: "disable", reason: "x" }))).toBeNull();
    expect(parseHelpForm(form({ reason: "x" }))).toBeNull();
    expect(parseHelpForm(form({ intent: "sendReset" }))?.reason).toBe("");
  });
});

describe("helpDoneMessage", () => {
  it("says what happened", () => {
    expect(helpDoneMessage("sendReset")).toBe("A password reset email is on its way.");
    expect(helpDoneMessage("revokeAllSessions", 1)).toBe("Signed out of 1 session.");
    expect(helpDoneMessage("revokeAllSessions", 3)).toBe("Signed out of 3 sessions.");
  });

  it("has words for every action", () => {
    for (const intent of HELP_INTENTS) {
      expect(HELP_COPY[intent].button).toBeTruthy();
      expect(helpDoneMessage(intent, 0)).toBeTruthy();
    }
  });
});
