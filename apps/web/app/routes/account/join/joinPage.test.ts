import { describe, expect, it } from "vitest";
import { CLOSED_CODE, stepForIssues } from "./joinPage";

describe("/join/:code", () => {
  it("has a plain message for every unusable state", () => {
    for (const state of ["notFound", "expired", "revoked", "usedUp"] as const) {
      expect(CLOSED_CODE[state].title.length).toBeGreaterThan(0);
      expect(CLOSED_CODE[state].message).toMatch(/new one/);
    }
  });
  it("says a switched-off sign-up isn't available right now", () => {
    expect(CLOSED_CODE.unavailable.title).toBe("Not available right now");
    expect(CLOSED_CODE.unavailable.message).toMatch(/isn't available right now/);
  });
  it("opens the step a refusal is about", () => {
    expect(stepForIssues(["group.recipientName"])).toBe("recipient");
    expect(stepForIssues(["email"])).toBe("account");
    expect(stepForIssues([])).toBe("account");
  });
});
