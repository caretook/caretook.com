import { describe, expect, it } from "vitest";

import { MARKETING_PAGES } from "../../routes/marketing/site/pages";
import { legalHref, legalLinks } from "./legalLinks";

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

describe("legalLinks", () => {
  it("lists the three pages, labelled, in order", () => {
    expect(legalLinks().map((l) => l.label)).toEqual([
      "Terms",
      "Privacy Policy",
      "Consumer Health Data Privacy Policy",
    ]);
  });

  it("links this site's own pages on the web", () => {
    expect(legalLinks().map((l) => l.href)).toEqual(["/terms", "/privacy", "/health-data-privacy"]);
    expect(legalLinks("").map((l) => l.href)).toEqual(["/terms", "/privacy", "/health-data-privacy"]);
  });

  it("uses the web origin on native, where the pages don't exist", () => {
    expect(legalLinks("https://caretook.example/").map((l) => l.href)).toEqual([
      "https://caretook.example/terms",
      "https://caretook.example/privacy",
      "https://caretook.example/health-data-privacy",
    ]);
  });

  it("names only real legal pages, all of them", () => {
    const legal = MARKETING_PAGES.filter((p) => p.area === "legal").map((p) => p.path as string);
    expect(
      legalLinks()
        .map((l) => l.href)
        .sort(),
    ).toEqual([...legal].sort());
  });
});
