// The test zones (zones.mjs): Node's test projects are pinned to the primary zone
// (vitest.config.ts sets TZ), so a result can't depend on the machine's own zone,
// and the browser projects take theirs from the browser context instead.
import { describe, expect, it } from "vitest";

import config from "../../vitest.config.ts";
import { PRIMARY_ZONE, SECOND_ZONE, secondZoneEnv, testZone } from "./zones.mjs";

/** @type {{ test: { name: string, env?: Record<string, string>, browser?: { enabled?: boolean } } }[]} */
const projects = /** @type {any} */ (config).test.projects;

describe("the test zones", () => {
  it("this node project reports the pinned zone", () => {
    expect(process.env.TZ).toBe(PRIMARY_ZONE);
    expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe(PRIMARY_ZONE);
    // 2027-06-09 is daylight time in Los Angeles: UTC−7.
    expect(new Date("2027-06-09T12:00:00Z").getTimezoneOffset()).toBe(7 * 60);
  });

  it("every node project pins TZ to the primary zone; no browser project does", () => {
    const node = projects.filter((p) => !p.test.browser?.enabled);
    expect(node.map((p) => p.test.name)).toEqual(
      expect.arrayContaining(["data:unit", "web:unit", "scripts:unit", "tooling:unit", "integration"]),
    );
    for (const p of node) expect([p.test.name, p.test.env?.TZ]).toEqual([p.test.name, PRIMARY_ZONE]);
    for (const p of projects.filter((p) => p.test.browser?.enabled)) expect(p.test.env?.TZ).toBeUndefined();
  });

  it("the second-zone project runs its own port, in New York", () => {
    const [primary, ny] = ["web:components", "web:components:ny"].map(
      (name) => /** @type {any} */ (projects.find((p) => p.test.name === name)).test,
    );
    expect(ny.api.port).not.toBe(primary.api.port);
    expect(ny.include.length).toBeGreaterThan(0);
  });

  it("the default zone is the primary; the second zone's env moves both the tests and the server", () => {
    expect(testZone({})).toBe(PRIMARY_ZONE);
    expect(testZone({ CARETOOK_TEST_ZONE: SECOND_ZONE })).toBe(SECOND_ZONE);
    expect(secondZoneEnv()).toEqual({ CARETOOK_TEST_ZONE: SECOND_ZONE, TZ: SECOND_ZONE });
  });
});
