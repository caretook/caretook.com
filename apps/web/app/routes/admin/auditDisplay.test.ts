import { describe, expect, it } from "vitest";
import { actionLabel, actorLabel, changeLines, targetLabel } from "./auditDisplay";

describe("auditDisplay", () => {
  it("names the actor, or the system", () => {
    expect(actorLabel({ id: "a", name: "Dev Admin", email: "admin@example.com" })).toBe(
      "Dev Admin (admin@example.com)",
    );
    expect(actorLabel({ id: "a", name: null, email: "admin@example.com" })).toBe("admin@example.com");
    expect(actorLabel(null)).toBe("System");
  });

  it("names the target account and group", () => {
    expect(
      targetLabel({
        targetUser: { id: "u", name: "Sam", email: "sam@example.com" },
        targetGroup: { id: "g", name: "Dev Family" },
      }),
    ).toBe("sam@example.com · Dev Family");
    expect(targetLabel({ targetUser: null, targetGroup: null })).toBe("");
    expect(targetLabel({ targetUser: null, targetGroup: { id: "g", name: null } })).toBe("Deleted group");
  });

  it("labels actions", () => {
    expect(actionLabel("accessCode.create")).toBe("Created an access code");
  });

  it("writes each change as before → after", () => {
    expect(
      changeLines({
        role: ["member", "support"],
        maxUses: [null, 5],
        code: ["ABCD-EFGH-JKMN", "ABCD-EFGH-JKMN"],
      }),
    ).toEqual(["role: member → support", "maxUses: none → 5", "code: ABCD-EFGH-JKMN"]);
  });
});
