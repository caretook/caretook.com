import { describe, expect, it } from "vitest";
import {
  authMessages,
  isBadToken,
  isCodeShaped,
  isUnverified,
  newPasswordProblem,
  normalizeCode,
  requestFailure,
  unreached,
} from "./authMessages";

describe("requestFailure", () => {
  it("names rate limits and lost connections, and nothing about the account", () => {
    expect(requestFailure(null)).toBeNull();
    expect(requestFailure({ status: 429 })).toBe(authMessages.tooManyTries);
    expect(requestFailure({})).toBe(authMessages.offline);
    expect(requestFailure({ status: 400, code: "USER_NOT_FOUND" })).toBeNull();
  });
});

describe("unreached", () => {
  it("turns a fetch that never reached the server into the offline message", () => {
    const { data, error } = unreached(new TypeError("Failed to fetch"));
    expect(data).toBeNull();
    expect(requestFailure(error)).toBe(authMessages.offline);
  });

  it("still throws anything else", () => {
    expect(() => unreached(new Error("a bug"))).toThrow("a bug");
  });
});

describe("the sent messages", () => {
  it("never say whether the address has an account", () => {
    for (const message of [authMessages.signInSent, authMessages.resetSent]) {
      expect(message("a@example.com")).toMatch(
        /^Check your email\. If a@example\.com has a Caretook account/,
      );
    }
  });
});

describe("error codes", () => {
  it("spots an unverified account and a bad token", () => {
    expect(isUnverified({ status: 403, code: "EMAIL_NOT_VERIFIED" })).toBe(true);
    expect(isUnverified({ status: 401, code: "INVALID_EMAIL_OR_PASSWORD" })).toBe(false);
    expect(isBadToken({ code: "INVALID_TOKEN" })).toBe(true);
    expect(isBadToken({ code: "TOKEN_EXPIRED" })).toBe(true);
    expect(isBadToken({ status: 429 })).toBe(false);
  });
});

describe("new passwords", () => {
  it("needs 12 characters and a matching confirmation", () => {
    expect(newPasswordProblem("short", "short")).toBe(authMessages.passwordTooShort);
    expect(newPasswordProblem("long enough pass", "long enough pasS")).toBe(authMessages.passwordsDiffer);
    expect(newPasswordProblem("long enough pass", "long enough pass")).toBeNull();
  });
});

describe("codes", () => {
  it("are six digits, spaces ignored", () => {
    expect(normalizeCode(" 123 456 ")).toBe("123456");
    expect(isCodeShaped("123 456")).toBe(true);
    expect(isCodeShaped("12345")).toBe(false);
    expect(isCodeShaped("12345a")).toBe(false);
  });
});
