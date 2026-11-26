// The verdict's kinds: what blocks, what is filed, what is a flake, for any tier;
// the jobs each tier waits for, and a job's Vitest reports summarized.
import { readFileSync, readdirSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { VERDICT_VERSION as READER_VERSION } from "./ci-runs.mjs";
import { jobsFor } from "./tiers.mjs";
import { VERDICT_VERSION, buildVerdict, mergeSummaries, summarizeJob, summarizeVitest } from "./verdict.mjs";

const ok = { result: "success" };
const base = { commit: "c".repeat(40), runId: "1" };
const brakes = ["packages/api/src/sync*.test.ts"];
const unitNeeds = (/** @type {object} */ unit) => ({ plan: ok, static: ok, unit });
const failing = (/** @type {object} */ summary) => ({
  result: "failure",
  outputs: {
    failures: JSON.stringify({
      reported: true,
      total: 5,
      files: [],
      tests: [],
      truncated: false,
      ...summary,
    }),
  },
});
const test = (/** @type {string} */ file, name = "breaks") => ({ file, name });
const unitVerdict = (/** @type {object} */ unit, extra = {}) =>
  buildVerdict({ ...base, tier: "unit", needs: unitNeeds(unit), brakes, ...extra });

describe("the verdict's kinds", () => {
  it.each(["static", "build"])("a failed %s job past its setup is a brake", (job) => {
    const needs = {
      plan: ok,
      static: ok,
      unit: ok,
      integration: ok,
      "components-1": ok,
      "components-2": ok,
      "components-3": ok,
      build: ok,
      [job]: { result: "failure", outputs: { started: "true" } },
    };
    expect(buildVerdict({ ...base, tier: "full", needs })).toMatchObject({
      kind: "brake",
      brake: { jobs: [job] },
    });
  });

  it("a static job that died in its setup is infra", () => {
    const needs = { plan: ok, static: { result: "failure" } };
    expect(buildVerdict({ ...base, tier: "static", needs })).toMatchObject({
      kind: "infra",
      infra: { jobs: ["static"] },
    });
  });

  it("a test job that failed before any test ran is infra", () => {
    expect(unitVerdict(failing({ reported: false, total: 0 })).kind).toBe("infra");
    expect(unitVerdict(failing({ total: 0 })).kind).toBe("infra");
    expect(unitVerdict({ result: "failure" }).kind).toBe("infra");
  });

  it("a failed plan is infra", () => {
    expect(buildVerdict({ ...base, tier: "static", needs: { plan: { result: "failure" } } }).kind).toBe(
      "infra",
    );
  });

  it("a job that failed with tests run and none named is file", () => {
    expect(unitVerdict(failing({})).kind).toBe("file");
  });

  it("a failing test on the brake list is a brake, even beside a file failure", () => {
    const tests = [test("packages/api/src/syncTodos.int.test.ts"), test("a.test.ts")];
    const v = unitVerdict(failing({ files: tests.map((t) => t.file), tests }));
    expect(v.kind).toBe("brake");
    expect(v.brake.tests.map((t) => t.file)).toEqual(["packages/api/src/syncTodos.int.test.ts"]);
  });

  it("a brake outranks infra, and infra outranks file: the run is partial", () => {
    const needs = {
      plan: ok,
      static: { result: "failure", outputs: { started: "true" } },
      unit: { result: "failure" },
    };
    expect(buildVerdict({ ...base, tier: "unit", needs }).kind).toBe("brake");
    const partial = {
      plan: ok,
      static: ok,
      unit: failing({ files: ["a.test.ts"], tests: [test("a.test.ts")] }),
      integration: { result: "failure" },
    };
    expect(buildVerdict({ ...base, tier: "integration", needs: partial }).kind).toBe("infra");
  });

  it("a failure that passes on the rerun is a flake", () => {
    const v = unitVerdict({
      result: "success",
      outputs: failing({
        files: ["a.test.ts"],
        tests: [test("a.test.ts")],
        rerun: { files: [], tests: [] },
      }).outputs,
    });
    expect(v.kind).toBe("flake");
    expect(v.flaky).toEqual([{ job: "unit", file: "a.test.ts", name: "breaks", brake: false }]);
    expect(v.afterRerun).toEqual({ files: [], tests: [] });
  });

  it("a flake on the brake list stays a flake, marked so it is never quarantined", () => {
    const file = "packages/api/src/syncTodos.int.test.ts";
    const v = unitVerdict({
      result: "success",
      outputs: failing({ files: [file], tests: [test(file)], rerun: { files: [], tests: [] } }).outputs,
    });
    expect(v.kind).toBe("flake");
    expect(v.flaky[0]?.brake).toBe(true);
  });

  it("a mix of flake and file is file, naming each", () => {
    const v = unitVerdict(
      failing({
        files: ["a.test.ts", "b.test.ts"],
        tests: [test("a.test.ts"), test("b.test.ts")],
        rerun: { files: ["b.test.ts"], tests: [test("b.test.ts")] },
      }),
    );
    expect(v.kind).toBe("file");
    expect(v.flaky.map((t) => t.file)).toEqual(["a.test.ts"]);
    expect(v.afterRerun?.tests).toEqual([{ job: "unit", file: "b.test.ts", name: "breaks" }]);
    expect(v.failed.files).toEqual(["a.test.ts", "b.test.ts"]);
  });

  it("a quarantined failure leaves the verdict green", () => {
    const quarantine = [{ file: "q.test.ts", name: "breaks", item: "B-1" }];
    const v = unitVerdict(failing({ files: ["q.test.ts"], tests: [test("q.test.ts")] }), { quarantine });
    expect(v.kind).toBe("green");
    expect(v.quarantined).toEqual([{ job: "unit", file: "q.test.ts", name: "breaks", status: "failed" }]);
  });

  it("carries the quarantine step's results and stays green", () => {
    const quarantined = [{ file: "q.test.ts", name: "breaks", status: "failed" }];
    const v = unitVerdict({
      result: "success",
      outputs: { failures: JSON.stringify({ reported: true, total: 1, files: [], tests: [], quarantined }) },
    });
    expect(v.kind).toBe("green");
    expect(v.quarantined).toEqual([{ job: "unit", ...quarantined[0] }]);
  });

  it("names the tier, and a unit run with no integration job is not infra", () => {
    const v = buildVerdict({
      ...base,
      tier: "unit",
      needs: { plan: ok, static: ok, unit: ok, integration: { result: "skipped" } },
    });
    expect(v).toMatchObject({ kind: "green", tier: "unit", ranTier: "unit" });
  });

  it("a narrowed verdict is marked, names its files and target, and needs only their jobs", () => {
    const target = "d".repeat(40);
    const files = ["a.test.ts", "packages/x/b.int.test.ts"];
    const v = buildVerdict({
      ...base,
      tier: "integration",
      needs: { plan: ok, static: { result: "skipped" }, unit: ok, integration: ok },
      narrowed: { target, files },
    });
    expect(v).toMatchObject({ kind: "green", narrowed: true, narrowedFiles: files, target });
    expect(v.commit).toBe(base.commit);
  });

  it("names every failing file and test", () => {
    const tests = [test("a.test.ts", "one"), test("a.test.ts", "two"), test("b.test.ts", "three")];
    const v = unitVerdict(failing({ files: ["a.test.ts", "b.test.ts", "import.test.ts"], tests }));
    expect(v.failed.files).toEqual(["a.test.ts", "b.test.ts", "import.test.ts"]);
    expect(v.failed.tests.map((t) => t.name)).toEqual(["one", "two", "three"]);
  });
});

describe("a job's summary", () => {
  const report = (/** @type {string} */ status, names = { breaks: status }) => ({
    testResults: [
      {
        name: "/w/a.test.ts",
        status,
        assertionResults: Object.entries(names).map(([fullName, s]) => ({ fullName, status: s })),
      },
    ],
  });
  const reads = (/** @type {Record<string, unknown>} */ files) => (/** @type {string} */ p) =>
    files[p] ?? null;

  it("reads a rerun that passed as nothing still failing", () => {
    const s = summarizeJob(
      ["r/u.json"],
      "/w",
      reads({ "r/u.json": report("failed"), "r/u.rerun.json": report("passed") }),
    );
    expect(s.rerun).toEqual({ files: [], tests: [] });
  });

  it("keeps a failure that a dead rerun can't speak for", () => {
    const s = summarizeJob(
      ["r/u.json"],
      "/w",
      reads({ "r/u.json": report("failed"), "r/u.rerun.json": { testResults: [] } }),
    );
    expect(s.rerun?.files).toEqual(["a.test.ts"]);
    expect(s.rerun?.tests).toEqual([{ file: "a.test.ts", name: "breaks" }]);
  });

  it("keeps the failures of a report with no rerun beside one that reran", () => {
    const other = {
      testResults: [
        { name: "/w/b.test.ts", status: "failed", assertionResults: [{ fullName: "b", status: "failed" }] },
      ],
    };
    const s = summarizeJob(
      ["r/u.json", "r/v.json"],
      "/w",
      reads({ "r/u.json": report("failed"), "r/u.rerun.json": report("passed"), "r/v.json": other }),
    );
    expect(s.rerun?.files).toEqual(["b.test.ts"]);
  });

  it("is null for the rerun when nothing reran, and lists the quarantine step's tests", () => {
    const q = report("failed", { breaks: "failed", other: "skipped" });
    const s = summarizeJob(
      ["r/u.json"],
      "/w",
      reads({ "r/u.json": report("passed"), "r/u.quarantine.json": q }),
    );
    expect(s.rerun).toBeNull();
    expect(s.quarantined).toEqual([{ file: "a.test.ts", name: "breaks", status: "failed" }]);
  });
});

describe("the verdict", () => {
  it("is green only when every job of the tier passed", () => {
    const v = buildVerdict({
      ...base,
      tier: "unit",
      needs: { plan: ok, static: ok, unit: ok, integration: { result: "skipped" } },
    });
    expect(v).toMatchObject({ version: 1, kind: "green", tier: "unit", ranTier: "unit", narrowed: false });
  });

  it("is file for a failed test job, naming the tests", () => {
    const failures = JSON.stringify({
      files: ["a.test.ts"],
      tests: [{ file: "a.test.ts", name: "breaks" }],
      truncated: false,
    });
    const v = buildVerdict({
      ...base,
      tier: "unit",
      needs: { plan: ok, static: ok, unit: { result: "failure", outputs: { failures } } },
    });
    expect(v.kind).toBe("file");
    expect(v.failed).toEqual({
      jobs: ["unit"],
      files: ["a.test.ts"],
      tests: [{ job: "unit", file: "a.test.ts", name: "breaks" }],
      truncated: false,
      unnamedJobs: [],
    });
    expect(
      buildVerdict({ ...base, tier: "unit", needs: { plan: ok, static: ok, unit: { result: "skipped" } } })
        .kind,
    ).toBe("infra");
    expect(
      buildVerdict({ ...base, tier: "static", needs: { plan: { result: "failure" } } }).failed.jobs,
    ).toEqual(["plan", "static"]);
  });

  it("waits for every job the tier ran: a full run needs its components and build", () => {
    const needs = {
      plan: ok,
      static: ok,
      unit: ok,
      integration: ok,
      "components-1": ok,
      "components-2": ok,
      "components-3": ok,
      build: ok,
    };
    expect(buildVerdict({ ...base, tier: "full", needs })).toMatchObject({
      kind: "green",
      tier: "full",
      ranTier: "full",
    });
    const noBuild = buildVerdict({
      ...base,
      tier: "full",
      needs: { ...needs, build: { result: "failure", outputs: { started: "true" } } },
    });
    expect(noBuild).toMatchObject({ kind: "brake", failed: { jobs: ["build"] } });
    const oneShard = { ...needs, "components-2": { result: "failure" } };
    expect(buildVerdict({ ...base, tier: "components", needs: oneShard })).toMatchObject({
      kind: "infra",
      failed: { jobs: ["components-2"] },
    });
    const skipped = { ...needs, build: { result: "skipped" } };
    expect(buildVerdict({ ...base, tier: "components", needs: skipped }).kind).toBe("green");
  });

  it("read a browser suite that failed as file, and one that never started as infra", () => {
    const needs = Object.fromEntries(
      ["plan", ...jobsFor("candidate").jobs].map((job) => [job, { result: "success" }]),
    );
    const run = { ...base, tier: "candidate" };
    expect(buildVerdict({ ...run, needs }).kind).toBe("green");
    const failed = (outputs) => ({ ...needs, browser: { result: "failure", outputs } });
    const ran = buildVerdict({ ...run, needs: failed({ started: "true" }) });
    expect(ran).toMatchObject({ kind: "file", failed: { jobs: ["browser"], unnamedJobs: ["browser"] } });
    expect(buildVerdict({ ...run, needs: failed({}) }).kind).toBe("infra");
  });

  it("summarizes a Vitest report, an import failure included", () => {
    const summary = summarizeVitest(
      {
        testResults: [
          {
            name: "/w/a.test.ts",
            status: "failed",
            assertionResults: [
              { status: "failed", fullName: " a breaks " },
              { status: "passed", fullName: "a works" },
            ],
          },
          { name: "/w/b.test.ts", status: "failed", assertionResults: [] },
          { name: "/w/c.test.ts", status: "passed", assertionResults: [{ status: "passed", fullName: "c" }] },
        ],
      },
      "/w",
    );
    expect(summary).toEqual({
      reported: true,
      total: 3,
      files: ["a.test.ts", "b.test.ts"],
      tests: [{ file: "a.test.ts", name: "a breaks" }],
      truncated: false,
    });
    expect(summarizeVitest(null, "/w").reported).toBe(false);
  });
});

describe("a job's reports", () => {
  const one = (/** @type {string} */ file) => ({
    reported: true,
    total: 1,
    files: [file],
    tests: [{ file, name: "breaks" }],
    truncated: false,
  });

  it("merge into one summary", () => {
    expect(mergeSummaries([one("a"), one("b")])).toEqual({
      reported: true,
      total: 2,
      files: ["a", "b"],
      tests: [
        { file: "a", name: "breaks" },
        { file: "b", name: "breaks" },
      ],
      truncated: false,
    });
  });

  it("say so when one is missing", () => {
    expect(mergeSummaries([one("a"), summarizeVitest(null, "/w")]).reported).toBe(false);
  });
});

// The core reads these files (ci-runs.mjs's isVerdict, blame, promote) through its own
// fixtures; this ties those fixtures and both version constants to what buildVerdict writes.
describe("the verdict fixtures", () => {
  const FIXTURES = new URL("./verdict.fixtures/", import.meta.url);
  const fixture = (/** @type {string} */ name) => JSON.parse(readFileSync(new URL(name, FIXTURES), "utf8"));
  /** Every key, nested objects walked (arrays and nulls kept as leaves). @returns {string[]} */
  const keysOf = (/** @type {unknown} */ v, prefix = "") =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.entries(v).flatMap(([k, x]) => [`${prefix}${k}`, ...keysOf(x, `${prefix}${k}.`)])
      : [];
  /** Every job of the tier passed. */
  const green = (/** @type {string} */ tier, /** @type {string} */ commit, /** @type {string} */ runId) =>
    buildVerdict({
      commit,
      runId,
      tier,
      needs: Object.fromEntries(["plan", ...jobsFor(tier).jobs].map((j) => [j, ok])),
    });

  it("carry the version buildVerdict writes, which the core's reader knows", () => {
    expect(green("unit", base.commit, "1").version).toBe(VERDICT_VERSION);
    expect(READER_VERSION).toBe(VERDICT_VERSION);
    for (const name of readdirSync(FIXTURES).filter((f) => f.endsWith(".json")))
      expect(fixture(name).version, name).toBe(VERDICT_VERSION);
  });

  it("have buildVerdict's fields, no more and no fewer", () => {
    const built = new Set(keysOf(green("candidate", base.commit, "1")));
    const optional = (/** @type {string} */ k) => /^(afterRerun|browser|secondZone)\./.test(k);
    for (const name of readdirSync(FIXTURES).filter((f) => f.endsWith(".json"))) {
      const have = keysOf(fixture(name)).filter((k) => !optional(k));
      expect(have.sort(), name).toEqual([...built].filter((k) => !optional(k)).sort());
    }
  });

  it.each([
    ["candidate-green.json", "candidate"],
    ["release-green.json", "release"],
  ])("%s is what a green %s run builds", (name, tier) => {
    const want = fixture(name);
    expect(green(tier, want.commit, want.runId)).toEqual(want);
  });
});
