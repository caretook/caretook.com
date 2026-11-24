import { describe, expect, it } from "vitest";
import { legalHref } from "./legalLinks";

describe("legalHref", () => {
  it("is a path on the web", () => {
    expect(legalHref("terms")).toBe("/terms");
    expect(legalHref("privacy", "")).toBe("/privacy");
    expect(legalHref("healthDataPrivacy", null)).toBe("/health-data-privacy");
  });

  it("is on the web's origin in the native build", () => {
    expect(legalHref("terms", "https://app.example.com/")).toBe("https://app.example.com/terms");
    expect(legalHref("healthDataPrivacy", "https://app.example.com")).toBe(
      "https://app.example.com/health-data-privacy",
    );
  });
});
