// The test zones (zones.mjs): Node's test projects are pinned to the primary zone
// (vitest.config.ts sets TZ), so a result can't depend on the machine's own zone,
// and the browser projects take theirs from the browser context instead.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import config from "../../vitest.config.ts";
import { DurationSequencer } from "./shard-sequencer.mjs";
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
      expect.arrayContaining([
        "data:unit",
        "web:unit",
        "core:unit",
        "project:unit",
        "project:tooling",
        "tooling:unit",
        "integration",
      ]),
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

  it("the component tests' copy of the second zone (apps/web/test/zone.ts) is the same", () => {
    const zoneTs = readFileSync(new URL("../../apps/web/test/zone.ts", import.meta.url), "utf8");
    expect(zoneTs).toContain(`export const SECOND_ZONE = "${SECOND_ZONE}";`);
  });
});

const WEB = new URL("../../apps/web/", import.meta.url);
/** Every component test file, from apps/web. */
const componentFiles = () =>
  execFileSync("git", ["ls-files", "*.browser.test.tsx"], { cwd: WEB, encoding: "utf8" }).trim().split("\n");
/** A workflow job's lines, from ci.yml. */
const jobBlock = (/** @type {string} */ yml, /** @type {string} */ name) => {
  const start = yml.indexOf(`\n  ${name}:\n`);
  if (start < 0) return null;
  const next = yml.slice(start + 1).search(/\n {2}[\w-]+:\n/);
  return yml.slice(start, next < 0 ? undefined : start + 1 + next);
};

describe("the second zone's files (B-772)", () => {
  const test = (/** @type {string} */ name) =>
    /** @type {any} */ (projects.find((p) => p.test.name === name)).test;

  it("every run: exactly the component files that build their moments with test/zone.ts", () => {
    const zoneAware = componentFiles()
      .filter((f) => /from "[./]*\/test\/zone"/.test(readFileSync(new URL(f, WEB), "utf8")))
      .sort();
    expect(zoneAware.length).toBeGreaterThan(0);
    expect([...test("web:components:ny").include].sort()).toEqual(zoneAware);
  });

  it("the release tier runs every component file in the second zone", () => {
    expect(test("web:components").include).toEqual([
      "app/**/*.browser.test.tsx",
      "test/**/*.browser.test.tsx",
    ]);
    const yml = readFileSync(new URL("../../.github/workflows/ci.yml", import.meta.url), "utf8");
    const jobs = [];
    for (let n = 1; jobBlock(yml, `zone-components-${n}`); n++)
      jobs.push(/** @type {string} */ (jobBlock(yml, `zone-components-${n}`)));
    expect(jobs.length).toBeGreaterThan(0);
    jobs.forEach((job, i) => {
      expect(job).toContain("needs.plan.outputs.release == 'true'");
      expect(job).toContain("node scripts/ci/env.mjs zone");
      expect(job).toMatch(
        new RegExp(`test-job\\.mjs --project web:components --shard=${i + 1}/${jobs.length} `),
      );
    });
  });

  it("shards balance by the durations table", () => {
    expect(/** @type {any} */ (config).test.sequence.sequencer).toBe(DurationSequencer);
  });
});
