import { describe, expect, it } from "vitest";
import {
  ACCOUNT_ACTION_CAPABILITY,
  ACCOUNT_ACTION_INTENTS,
  accountActionDoneMessage,
  parseAccountActionForm,
  ROLE_OPTIONS,
  setGroupLimitCopy,
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

  it("reads a care group limit, blank for the default", () => {
    expect(
      parseAccountActionForm(form({ intent: "setGroupLimit", reason: "Two families", limit: " 5 " })),
    ).toEqual({ intent: "setGroupLimit", reason: "Two families", limit: 5 });
    expect(parseAccountActionForm(form({ intent: "setGroupLimit", reason: "Back", limit: "" }))).toEqual({
      intent: "setGroupLimit",
      reason: "Back",
      limit: null,
    });
    expect(
      parseAccountActionForm(form({ intent: "setGroupLimit", reason: "x", limit: "lots" }))?.limit,
    ).toBeNaN();
  });

  it("leaves help actions to the help parser, and the other way round", () => {
    expect(parseAccountActionForm(form({ intent: "sendReset", reason: "x" }))).toBeNull();
    expect(parseHelpForm(form({ intent: "enable", reason: "x" }))).toBeNull();
    expect(parseAccountActionForm(form({ reason: "x" }))).toBeNull();
  });
});

describe("the admin actions' words", () => {
  it("need their own capability each: admins' for access, users.limits for the group limit", () => {
    for (const intent of ACCOUNT_ACTION_INTENTS) {
      expect(["users.disable", "users.setRole", "users.limits"]).toContain(ACCOUNT_ACTION_CAPABILITY[intent]);
    }
    expect(ACCOUNT_ACTION_CAPABILITY.setGroupLimit).toBe("users.limits");
  });

  it("say what happened", () => {
    expect(accountActionDoneMessage("disable", { revoked: 1 })).toBe("Disabled. Signed out of 1 session.");
    expect(accountActionDoneMessage("disable", { revoked: 0 })).toBe("Disabled. Signed out of 0 sessions.");
    expect(accountActionDoneMessage("enable")).toBe("Re-enabled. They can sign in again.");
    expect(accountActionDoneMessage("setRole", { role: "admin" })).toBe("They're an admin now.");
    expect(accountActionDoneMessage("setRole", { role: "member" })).toBe("They're a member now.");
    expect(accountActionDoneMessage("setGroupLimit", { limit: 5, override: 5 })).toBe(
      "They can start 5 care groups now.",
    );
    expect(accountActionDoneMessage("setGroupLimit", { limit: 1, override: null })).toBe(
      "Back to the default: 1 care group.",
    );
  });

  it("offer Admin, Support and Member, and confirm each", () => {
    expect(ROLE_OPTIONS.map((o) => o.label)).toEqual(["Admin", "Support", "Member"]);
    expect(setRoleCopy("support").title).toBe("Make them Support?");
    expect(setRoleCopy("member").title).toBe("Remove their staff role?");
    expect(setRoleCopy("owner").title).toBe("Remove their staff role?");
  });

  it("confirm a care group limit, or going back to the default", () => {
    expect(setGroupLimitCopy(5).title).toBe("Let them start 5 care groups?");
    expect(setGroupLimitCopy(null)).toMatchObject({
      title: "Use the default limit?",
      confirm: "Use default",
    });
  });
});
