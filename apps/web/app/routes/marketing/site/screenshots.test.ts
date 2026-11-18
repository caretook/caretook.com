import { existsSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { content as features } from "../features/content";
import { homeContent } from "../home/content";
import { screenshotFiles, screenshotSrc, SCREENSHOTS, type ScreenshotRef } from "./screenshots";

const PUBLIC = fileURLToPath(new URL("../../../../public", import.meta.url));

// Every screenshot a content module shows, with where it's used.
const used: [string, ScreenshotRef][] = [
  ...homeContent.gallery.shots.map((s) => ["home gallery", s] as [string, ScreenshotRef]),
  ...features.showcases.flatMap((s) =>
    s.image ? [[`features #${s.id}`, s.image] as [string, ScreenshotRef]] : [],
  ),
];

describe("screenshots", () => {
  it("every file the site can reference is in public/, and none is heavy", () => {
    for (const file of screenshotFiles()) {
      const path = `${PUBLIC}${file}`;
      expect(existsSync(path), file).toBe(true);
      // The PRD's budget: an LCP image under about 150 KB.
      expect(statSync(path).size, file).toBeLessThan(150 * 1024);
    }
  });

  it("points at the SVG placeholders", () => {
    expect(screenshotSrc("members")).toBe("/screenshots/members.svg");
  });

  it("content names only known screens, each with descriptive alt text", () => {
    expect(used.length).toBeGreaterThan(0);
    for (const [where, ref] of used) {
      expect(SCREENSHOTS, where).toHaveProperty(ref.name);
      expect(ref.alt.length, where).toBeGreaterThanOrEqual(40);
      expect(ref.alt, where).not.toMatch(/^(screenshot|image|picture) of/i);
    }
  });
});
