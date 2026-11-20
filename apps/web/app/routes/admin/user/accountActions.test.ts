import { describe, expect, it } from "vitest";
import {
  ACCOUNT_ACTION_CAPABILITY,
  ACCOUNT_ACTION_INTENTS,
  accountActionDoneMessage,
  parseAccountActionForm,
  ROLE_OPTIONS,
  setRoleCopy,
} from "./accountActions";
import { parseHelpForm } from "./helpActions";

const form = (values: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
};

describe("parseAccountActionForm", () => {
  it("reads the intent, the trimmed reason and, for a role change only, the role", () => {
    expect(parseAccountActionForm(form({ intent: "disable", reason: " Abuse ", role: "admin" }))).toEqual({
      intent: "disable",
      reason: "Abuse",
    });
    expect(parseAccountActionForm(form({ intent: "setRole", reason: "Hired", role: " support " }))).toEqual({
      intent: "setRole",
      reason: "Hired",
      role: "support",
    });
  });

  it("leaves help actions to the help parser, and the other way round", () => {
    expect(parseAccountActionForm(form({ intent: "sendReset", reason: "x" }))).toBeNull();
    expect(parseHelpForm(form({ intent: "enable", reason: "x" }))).toBeNull();
    expect(parseAccountActionForm(form({ reason: "x" }))).toBeNull();
  });
});

describe("the admin actions' words", () => {
  it("need an admin capability each", () => {
    for (const intent of ACCOUNT_ACTION_INTENTS) {
      expect(["users.disable", "users.setRole"]).toContain(ACCOUNT_ACTION_CAPABILITY[intent]);
    }
  });

  it("say what happened", () => {
    expect(accountActionDoneMessage("disable", { revoked: 1 })).toBe("Disabled. Signed out of 1 session.");
    expect(accountActionDoneMessage("disable", { revoked: 0 })).toBe("Disabled. Signed out of 0 sessions.");
    expect(accountActionDoneMessage("enable")).toBe("Re-enabled. They can sign in again.");
    expect(accountActionDoneMessage("setRole", { role: "admin" })).toBe("They're an admin now.");
    expect(accountActionDoneMessage("setRole", { role: "member" })).toBe("They're a member now.");
  });

  it("offer Admin, Support and Member, and confirm each", () => {
    expect(ROLE_OPTIONS.map((o) => o.label)).toEqual(["Admin", "Support", "Member"]);
    expect(setRoleCopy("support").title).toBe("Make them Support?");
    expect(setRoleCopy("member").title).toBe("Remove their staff role?");
    expect(setRoleCopy("owner").title).toBe("Remove their staff role?");
  });
});
