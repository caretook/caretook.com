// The shards balanced by past durations (shards.mjs, shard-sequencer.mjs).
import { describe, expect, it } from "vitest";

import { shardSpecs } from "./shard-sequencer.mjs";
import {
  DURATIONS_FILE,
  balanceShards,
  durationsTable,
  parseShardLog,
  readDurations,
  refresh,
  shardJobs,
} from "./shards.mjs";

const total = (/** @type {string[]} */ keys, /** @type {Record<string, number>} */ s) =>
  keys.reduce((sum, k) => sum + s[k], 0);

// Fictional files and seconds, shaped like the component shards: a few long ones.
const SECONDS = Object.fromEntries(
  [
    57.4, 41.3, 31.5, 31.4, 30.6, 29.3, 28.9, 25.6, 20.9, 19.5, 18.4, 12, 9.4, 7.7, 5.1, 3.3, 2.2, 1.6, 0.9,
    0.4, 0.2,
  ].map((s, i) => [`f${String(i).padStart(2, "0")}`, s]),
);
const ITEMS = Object.entries(SECONDS).map(([key, seconds]) => ({ key, seconds }));

describe("balanceShards", () => {
  it("three shards from a durations table differ by at most the largest file", () => {
    const shards = balanceShards(ITEMS, 3);
    const totals = shards.map((keys) => total(keys, SECONDS));
    expect(Math.max(...totals) - Math.min(...totals)).toBeLessThanOrEqual(
      Math.max(...Object.values(SECONDS)),
    );
    expect(shards.flat().sort()).toEqual(Object.keys(SECONDS).sort());
  });

  it("a file with no duration goes by count", () => {
    const untimed = ["n1", "n2", "n3", "n4"].map((key) => ({ key }));
    // Each new file goes to the shard with the fewest files, the least time breaking a tie.
    const shards = balanceShards(
      [{ key: "a", seconds: 10 }, { key: "b", seconds: 10 }, { key: "c", seconds: 1 }, ...untimed],
      3,
    );
    expect(shards).toEqual([
      ["a", "n2"],
      ["b", "n3"],
      ["c", "n1", "n4"],
    ]);
    // With no table at all, the files split evenly by count.
    const none = balanceShards(
      Array.from({ length: 7 }, (_, i) => ({ key: `x${i}` })),
      3,
    );
    expect(none.map((s) => s.length)).toEqual([3, 2, 2]);
  });

  it("the same input gives the same shards, in any order", () => {
    const once = balanceShards(ITEMS, 3);
    expect(balanceShards([...ITEMS].reverse(), 3)).toEqual(once);
    expect(balanceShards([...ITEMS.slice(7), ...ITEMS.slice(0, 7)], 3)).toEqual(once);
    // Equal seconds still split the same way every time.
    const ties = ["d", "b", "c", "a"].map((key) => ({ key, seconds: 5 }));
    expect(balanceShards(ties, 2)).toEqual([
      ["a", "c"],
      ["b", "d"],
    ]);
    expect(() => balanceShards(ITEMS, 0)).toThrow(/at least 1/);
  });
});

const spec = (/** @type {string} */ project, /** @type {string} */ file) => ({
  moduleId: `/repo/apps/web/${file}`,
  project: { name: project, config: { root: "/repo/apps/web" } },
});

describe("shardSpecs (the sequencer's shard step)", () => {
  const specs = [
    spec("web:components", "app/a.browser.test.tsx"),
    spec("web:components", "app/b.browser.test.tsx"),
    spec("web:components", "app/new.browser.test.tsx"),
    // A browser project's instance is part of its name; the table's is without it.
    spec("web:components:ny (chromium)", "app/a.browser.test.tsx"),
  ];
  const table = {
    "web:components": { "app/a.browser.test.tsx": 30, "app/b.browser.test.tsx": 20 },
    "web:components:ny": { "app/a.browser.test.tsx": 25 },
  };

  it("keys a file by its project, so one file's two zones are two items", () => {
    const shards = [1, 2].map((index) => shardSpecs(specs, { index, count: 2 }, table));
    expect(
      shards.map((s) => s.map((x) => `${x.project.name} ${x.moduleId.slice("/repo/apps/web/".length)}`)),
    ).toEqual([
      ["web:components app/a.browser.test.tsx", "web:components app/new.browser.test.tsx"],
      ["web:components:ny (chromium) app/a.browser.test.tsx", "web:components app/b.browser.test.tsx"],
    ]);
  });

  it("every spec runs in exactly one shard", () => {
    for (const count of [1, 2, 3]) {
      const all = Array.from({ length: count }, (_, i) =>
        shardSpecs(specs, { index: i + 1, count }, table),
      ).flat();
      expect(all).toHaveLength(specs.length);
      expect(new Set(all)).toEqual(new Set(specs));
    }
  });

  it("the committed table covers the component projects", () => {
    const committed = readDurations(DURATIONS_FILE);
    expect(Object.keys(committed)).toEqual(expect.arrayContaining(["web:components"]));
    for (const files of Object.values(committed))
      for (const [file, s] of Object.entries(files))
        expect([file, Number.isFinite(s) && s >= 0]).toEqual([file, true]);
    expect(readDurations(new URL("./no-such-durations.json", import.meta.url))).toEqual({});
  });
});

// A shard job's log, as GitHub serves it: timestamps, colours, step groups.
const LOG = [
  "2027-06-09T12:00:00.0000000Z ##[group]Run node scripts/ci/test-job.mjs --time-gate --project web:components --project web:components:ny --shard=1/3 --reporter=default",
  "2027-06-09T12:00:01.0000000Z  \x1b[32m✓\x1b[39m  \x1b[30m\x1b[46m web:components:ny \x1b[49m\x1b[39m \x1b[2m(chromium)\x1b[22m  app/t/x.browser.test.tsx \x1b[2m(24 tests)\x1b[22m\x1b[33m 31486\x1b[2mms\x1b[22m\x1b[39m",
  "2027-06-09T12:00:01.1000000Z    ✓ a test inside it 1898ms",
  "2027-06-09T12:00:02.0000000Z  ❯  web:components (chromium)  app/t/y.browser.test.tsx (3 tests | 1 failed) 2400ms",
  "2027-06-09T12:00:03.0000000Z  ✓  web:components (chromium)  app/t/z.browser.test.tsx (1 test) 391ms",
  // The rerun prints a failed file again: its first line counts.
  "2027-06-09T12:00:04.0000000Z  ✓  web:components (chromium)  app/t/y.browser.test.tsx (3 tests) 9000ms",
  "2027-06-09T12:00:05.0000000Z ##[group]Run node scripts/ci/test-job.mjs --quarantine --project web:components --reporter=default",
  "2027-06-09T12:00:06.0000000Z  ✓  web:components (chromium)  app/t/q.browser.test.tsx (8 tests | 7 skipped) 500ms",
].join("\n");

describe("refreshing the table", () => {
  it("reads each file's first line in the sharded test step only", () => {
    expect(parseShardLog(LOG)).toEqual([
      { project: "web:components:ny", file: "app/t/x.browser.test.tsx", seconds: 31.486 },
      { project: "web:components", file: "app/t/y.browser.test.tsx", seconds: 2.4 },
      { project: "web:components", file: "app/t/z.browser.test.tsx", seconds: 0.391 },
    ]);
  });

  it("writes a sorted table to a tenth of a second", () => {
    expect(JSON.stringify(durationsTable(parseShardLog(LOG)))).toBe(
      JSON.stringify({
        "web:components": { "app/t/y.browser.test.tsx": 2.4, "app/t/z.browser.test.tsx": 0.4 },
        "web:components:ny": { "app/t/x.browser.test.tsx": 31.5 },
      }),
    );
  });

  it("refreshes from a run's components-N jobs, through gh", () => {
    const jobs = JSON.stringify({
      jobs: [
        { name: "unit", databaseId: 1 },
        { name: "components-1", databaseId: 2 },
        { name: "zone-components-1", databaseId: 3 },
      ],
    });
    expect(shardJobs(jobs)).toEqual([{ name: "components-1", id: "2" }]);
    /** @type {string[][]} */ const calls = [];
    /** @type {string[]} */ const written = [];
    refresh("123", {
      gh: (args) => (calls.push(args), args[0] === "run" ? jobs : LOG),
      write: (text) => written.push(text),
      log: () => {},
    });
    expect(calls).toEqual([
      ["run", "view", "123", "--json", "jobs"],
      ["api", "--allow-escape-sequences", "repos/{owner}/{repo}/actions/jobs/2/logs"],
    ]);
    expect(JSON.parse(written[0])["web:components:ny"]).toEqual({ "app/t/x.browser.test.tsx": 31.5 });
    expect(() => refresh("abc", { gh: () => "", write: () => {}, log: () => {} })).toThrow(/a run id/);
    expect(() =>
      refresh("1", { gh: () => JSON.stringify({ jobs: [] }), write: () => {}, log: () => {} }),
    ).toThrow(/no components-N jobs/);
  });
});
