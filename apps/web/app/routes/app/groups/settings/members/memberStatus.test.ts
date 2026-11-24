import { describe, expect, it } from "vitest";
import { memberStatusLine } from "./memberStatus";

describe("memberStatusLine", () => {
  it("says whether the email is confirmed", () => {
    expect(memberStatusLine({ emailVerified: false, lastSignInAt: null }, "en-US")).toBe(
      "Email not confirmed",
    );
    expect(memberStatusLine({ emailVerified: true, lastSignInAt: null }, "en-US")).toBe("Email confirmed");
  });

  it("adds the last sign-in only while a session remains", () => {
    expect(memberStatusLine({ emailVerified: true, lastSignInAt: "2026-11-22T18:30:00.000Z" }, "en-US")).toBe(
      "Email confirmed · Last signed in Nov 22, 2026",
    );
  });
});
