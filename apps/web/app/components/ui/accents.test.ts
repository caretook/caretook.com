import { describe, expect, test } from "vitest";

import { ACCENTS, accentClass } from "./accents";

const LOOKS = ["solid", "soft", "text"] as const;
const FORBIDDEN = /\b(?:bg|text|border)-(?:info|success|warning|error|primary|secondary|accent)\b/;

describe("accentClass", () => {
  test.each([...ACCENTS, "neutral"] as const)(
    "%s has classes for every look, and no status token",
    (accent) => {
      for (const look of LOOKS) {
        const classes = accentClass(accent, look);
        expect(classes, `${accent} ${look}`).not.toBe("");
        expect(classes, `${accent} ${look}`).not.toMatch(FORBIDDEN);
      }
    },
  );

  test("each accent's looks differ", () => {
    for (const accent of ACCENTS) {
      expect(new Set(LOOKS.map((look) => accentClass(accent, look))).size).toBe(3);
    }
  });
});
