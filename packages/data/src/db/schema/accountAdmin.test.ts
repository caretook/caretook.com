import { describe, expect, it } from "vitest";
import { accountHelpZSchema, accountSearchZSchema, mailErrorCode } from "./accountAdmin";

describe("mailErrorCode", () => {
  it("is null without an error", () => {
    expect(mailErrorCode("sent", null)).toBeNull();
    expect(mailErrorCode("pending", "")).toBeNull();
  });

  it("names a skip outside production without the sender's words", () => {
    expect(mailErrorCode("skipped", "Not on MAIL_ALLOWLIST (outside production)")).toBe("notAllowlisted");
    expect(mailErrorCode("skipped", "something else")).toBe("skipped");
  });

  it("keeps only a provider error's name", () => {
    expect(mailErrorCode("failed", "validation_error: The to address pat@example.com is invalid")).toBe(
      "validation_error",
    );
    expect(mailErrorCode("pending", "connect ECONNREFUSED 127.0.0.1:443")).toBe("error");
  });
});

describe("the account inputs", () => {
  it("requires a reason for a help action", () => {
    const userId = "0b6f3c1e-5d1a-4c2e-9a77-3f1d2b8c0001";
    expect(accountHelpZSchema.safeParse({ userId, reason: "  " }).success).toBe(false);
    expect(accountHelpZSchema.safeParse({ userId }).success).toBe(false);
    expect(accountHelpZSchema.safeParse({ userId, reason: "x".repeat(501) }).success).toBe(false);
    expect(accountHelpZSchema.parse({ userId, reason: " Asked by phone " }).reason).toBe("Asked by phone");
  });

  it("defaults the search to the first page", () => {
    expect(accountSearchZSchema.parse({})).toEqual({ page: 1 });
    expect(accountSearchZSchema.parse({ q: " pat ", page: 3 })).toEqual({ q: "pat", page: 3 });
  });
});
