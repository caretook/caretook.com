import { describe, expect, it } from "vitest";

import { MARKETING_PAGES } from "../../../marketing/site/pages";
import { legalLinks } from "./legalLinks";

describe("legalLinks", () => {
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
