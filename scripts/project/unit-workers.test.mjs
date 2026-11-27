// The unit projects' worker cap (vitest.config.ts, B-542): half the cores, at most
// 4, or CARETOOK_UNIT_WORKERS; every unit project carries it, the tooling projects
// keep Vitest's default in a group of their own, and the other caps stay as they are.
import { describe, expect, it } from "vitest";

import config, { unitWorkers } from "../../vitest.config.ts";

/** @type {{ test: { name: string, maxWorkers?: number, sequence?: { groupOrder?: number } } }[]} */
const projects = /** @type {any} */ (config).test.projects;
const byName = new Map(projects.map((p) => [p.test.name, p.test]));

const UNIT = ["data:unit", "web:unit", "notifications:unit", "server:unit", "core:unit", "project:unit"];
const TOOLING = ["project:tooling", "tooling:unit", "tooling:browser"];

describe("unitWorkers", () => {
  it("defaults to half the cores, at most 4 and at least 1", () => {
    expect(unitWorkers(undefined, 10)).toBe(4);
    expect(unitWorkers("", 16)).toBe(4);
    expect(unitWorkers(" ", 6)).toBe(3);
    expect(unitWorkers(undefined, 4)).toBe(2);
    expect(unitWorkers(undefined, 1)).toBe(1);
  });

  it("reads CARETOOK_UNIT_WORKERS: 1 to 64, else refused", () => {
    expect(unitWorkers("1", 10)).toBe(1);
    expect(unitWorkers("9", 10)).toBe(9);
    expect(unitWorkers("64", 10)).toBe(64);
    for (const bad of ["0", "65", "2.5", "four", "-1"]) expect(unitWorkers(bad, 10), bad).toBeUndefined();
  });
});

describe("the config's worker caps", () => {
  const cap = unitWorkers(process.env.CARETOOK_UNIT_WORKERS);

  it("every unit project carries the unit cap, in the default group", () => {
    expect(cap).toBeGreaterThanOrEqual(1);
    for (const name of UNIT) {
      expect(byName.get(name)?.maxWorkers, name).toBe(cap);
      expect(byName.get(name)?.sequence?.groupOrder, name).toBeUndefined();
    }
  });

  it("the tooling projects keep Vitest's default, in a group of their own", () => {
    for (const name of TOOLING) {
      expect(byName.get(name)?.maxWorkers, name).toBeUndefined();
      expect(byName.get(name)?.sequence?.groupOrder, name).toBe(3);
    }
  });

  it("each group's projects share one cap, and the others keep theirs", () => {
    /** @type {Map<number, Set<number | undefined>>} */
    const groups = new Map();
    for (const { test } of projects) {
      const order = test.sequence?.groupOrder ?? 0;
      groups.set(order, (groups.get(order) ?? new Set()).add(test.maxWorkers));
    }
    for (const [order, caps] of groups) expect(caps.size, `group ${order}`).toBe(1);
    expect(byName.get("web:components")?.maxWorkers).toBe(2);
    expect(byName.get("integration")?.maxWorkers).toBeGreaterThanOrEqual(1);
  });
});
