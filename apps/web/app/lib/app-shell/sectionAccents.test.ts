import { describe, expect, test } from "vitest";

import { ACCENTED_SECTIONS, sectionAccent } from "./sectionAccents";

describe("sectionAccent", () => {
  test("each of the five sections has its accent and an icon", () => {
    const accents = ACCENTED_SECTIONS.map((id) => {
      const look = sectionAccent(id, { easy: false });
      expect(look?.icon, id).toBeDefined();
      return [id, look?.accent];
    });
    expect(Object.fromEntries(accents)).toEqual({
      timeline: "indigo",
      medications: "teal",
      planner: "orange",
      providers: "lime",
      periods: "plum",
    });
  });

  test("returns nothing when easy", () => {
    for (const id of ACCENTED_SECTIONS) expect(sectionAccent(id, { easy: true })).toBeUndefined();
  });
});
