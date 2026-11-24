// The verdict's kinds: what blocks, what is filed, what is a flake, for any tier.
import { describe, expect, it } from "vitest";

import { buildVerdict, summarizeJob } from "./verdict.mjs";

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
