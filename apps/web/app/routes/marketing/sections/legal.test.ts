import { describe, expect, it } from "vitest";

import { content as accessibility } from "../accessibility/content";
import { content as healthData } from "../health-data-privacy/content";
import { content as privacy } from "../privacy/content";
import { content as terms } from "../terms/content";
import { MARKETING_PAGES } from "../site/pages";
import { TOC_MIN_SECTIONS, formatLegalDate, inlineParts } from "./legal";
import type { LegalPageContent } from "./legal";

// The legal content modules' shape: what the legal page needs to render, so a
// copy edit can't drop the date, the draft banner or a heading's anchor.
const PAGES: [string, LegalPageContent][] = [
  ["privacy", privacy],
  ["terms", terms],
  ["health-data-privacy", healthData],
  ["accessibility", accessibility],
];
const nonEmpty = (s: string) => s.trim().length > 0;
const internalPaths = new Set<string>(MARKETING_PAGES.map((p) => p.path));

describe.each(PAGES)("%s content", (_, page) => {
  it("has a title, a search-length description and an h1", () => {
    expect(nonEmpty(page.meta.title)).toBe(true);
    expect(page.meta.description.length).toBeGreaterThanOrEqual(70);
    expect(page.meta.description.length).toBeLessThanOrEqual(200);
    expect(nonEmpty(page.heading)).toBe(true);
  });

  it("has a real last-updated date and is still marked as a draft", () => {
    expect(page.lastUpdated).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(formatLegalDate(page.lastUpdated)).not.toMatch(/invalid/i);
    expect(page.draft).toBe(true);
  });

  it("gives every section a unique anchor id, a heading, a summary and formal text", () => {
    const ids = page.sections.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of page.sections) {
      expect(s.id).toMatch(/^[a-z][a-z0-9-]*$/);
      expect(nonEmpty(s.heading) && nonEmpty(s.summary)).toBe(true);
      expect(s.formal.length).toBeGreaterThan(0);
    }
  });

  it("links only to marketing pages and to sections that exist", () => {
    const texts = [
      ...page.intro,
      ...page.sections.flatMap((s) => [
        s.summary,
        ...s.formal.flatMap((b) => (typeof b === "string" ? [b] : "list" in b ? b.list : [])),
      ]),
    ];
    const anchors: Record<string, string[]> = Object.fromEntries(
      PAGES.map(([id, p]) => [`/${id}`, p.sections.map((s) => s.id)]),
    );
    for (const part of texts.flatMap(inlineParts)) {
      if (typeof part === "string") continue;
      const [path, hash] = part.href.split("#");
      if (path) expect(internalPaths).toContain(path);
      if (hash) expect(path ? anchors[path] : page.sections.map((s) => s.id)).toContain(hash);
    }
  });
});

describe("compliance coverage", () => {
  const text = (page: LegalPageContent) => JSON.stringify(page);
  it("covers AGENTS.md's Compliance points", () => {
    for (const point of [
      /HIPAA/,
      /Health Breach Notification Rule/,
      /never sell/i,
      /analytics/,
      /consent/i,
    ]) {
      expect(text(privacy)).toMatch(point);
    }
    for (const point of [/delet/i, /encrypt/i, /train/i, /\[privacy email\]/])
      expect(text(privacy)).toMatch(point);
    for (const point of [/My Health My Data/, /appeal/i, /withdraw consent/i, /delete/i]) {
      expect(text(healthData)).toMatch(point);
    }
    expect(text(terms)).toMatch(/medical advice/i);
  });
});

describe("connecting your own AI assistant", () => {
  const withSection = [
    ["privacy", privacy],
    ["health-data-privacy", healthData],
  ] as const;
  it.each(withSection)("%s has the section with an anchor, which the table of contents lists", (_, page) => {
    expect(page.sections.map((s) => s.id)).toContain("own-assistant");
    // The table of contents is built from every section when there are enough of them.
    expect(page.sections.length).toBeGreaterThanOrEqual(TOC_MIN_SECTIONS);
  });
  it("keeps the promises the code keeps", () => {
    const text = JSON.stringify(privacy.sections.find((s) => s.id === "own-assistant"));
    expect(text).toMatch(/contact details/);
    expect(text).toMatch(/off for every care group until an owner/);
    expect(text).toMatch(/Settings, Devices/);
    expect(text).toMatch(/do not keep a record of what the assistant/);
  });
});

describe("accessibility statement", () => {
  it("is a site page, not one of the accepted legal documents", () => {
    expect(MARKETING_PAGES.find((p) => p.id === "accessibility")).toMatchObject({
      path: "/accessibility",
      area: "site",
    });
  });

  it("has enough sections for a table of contents", () => {
    expect(accessibility.sections.length).toBeGreaterThanOrEqual(TOC_MIN_SECTIONS);
  });

  // The claims test's banned words (site/claims.test.ts, not edited here).
  it("says none of the claims test's banned phrases", () => {
    const text = JSON.stringify(accessibility);
    for (const pattern of [/early[\s-]*access/i, /hipaa/i, /free[\s-]*forever/i, /\b(in)?secure(ly|d)?\b/i]) {
      expect(text).not.toMatch(pattern);
    }
  });
});

describe("inlineParts", () => {
  it("splits internal links out and leaves placeholders as text", () => {
    expect(inlineParts("Write to [privacy email] or see [the policy](/privacy#deletion).")).toEqual([
      "Write to [privacy email] or see ",
      { text: "the policy", href: "/privacy#deletion" },
      ".",
    ]);
    expect(inlineParts("[Jump](#consent)")).toEqual([{ text: "Jump", href: "#consent" }]);
    expect(inlineParts("[External](https://example.com)")).toEqual(["[External](https://example.com)"]);
  });
});
