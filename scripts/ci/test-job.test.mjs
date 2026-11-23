// A CI test step against a fake Vitest: the one rerun of the failed files, what a
// narrowed run keeps, and a quarantine step that can't fail.
import { describe, expect, it } from "vitest";

import { MAX_RERUN_FILES, failedFiles, runQuarantine, runStep, stepGroup } from "./test-job.mjs";

const OUT = "ci-results/unit.json";
const ARGS = ["--project", "data:unit", "--shard=1/2", "--reporter=json", `--outputFile.json=${OUT}`];
const report = (/** @type {string[]} */ files) =>
  JSON.stringify({
    testResults: files.map((f) => ({ name: `/w/${f}`, status: "failed", assertionResults: [] })),
  });

function fake({ codes = [0], texts = /** @type {Record<string, string>} */ ({}) } = {}) {
  /** @type {{ args: string[], env: Record<string, string> }[]} */ const runs = [];
  /** @type {string[]} */ const lines = [];
  const io = {
    run(/** @type {string[]} */ args, /** @type {Record<string, string>} */ env) {
      runs.push({ args, env });
      return codes[runs.length - 1] ?? 0;
    },
    readText: (/** @type {string} */ p) => texts[p] ?? null,
    log: (/** @type {string} */ l) => lines.push(l),
    root: "/w",
  };
  return { io, runs, lines };
}

describe("a test step", () => {
  it("doesn't rerun a pass", () => {
    const f = fake();
    expect(runStep(ARGS, f.io)).toBe(0);
    expect(f.runs).toHaveLength(1);
  });

  it("reruns only the failed files, whole and once, and passes when they do", () => {
    const f = fake({ codes: [1, 0], texts: { [OUT]: report(["a.test.ts", "b.test.ts"]) } });
    expect(runStep(ARGS, f.io)).toBe(0);
    expect(f.runs).toHaveLength(2);
    const { args, env } = /** @type {{ args: string[], env: object }} */ (f.runs[1]);
    expect(args).toContain("--outputFile.json=ci-results/unit.rerun.json");
    expect(args.some((a) => a.startsWith("--shard"))).toBe(false);
    expect(args.slice(-2)).toEqual(["a.test.ts", "b.test.ts"]);
    expect(env).toEqual({ CARETOOK_CI_RERUN: "1" });
  });

  it("fails when the rerun fails too", () => {
    const f = fake({ codes: [1, 1], texts: { [OUT]: report(["a.test.ts"]) } });
    expect(runStep(ARGS, f.io)).toBe(1);
    expect(f.runs).toHaveLength(2);
  });

  it("doesn't rerun with no report, or no failed file in it", () => {
    const none = fake({ codes: [7] });
    expect(runStep(ARGS, none.io)).toBe(7);
    expect(none.runs).toHaveLength(1);
    const empty = fake({ codes: [1], texts: { [OUT]: report([]) } });
    expect(runStep(ARGS, empty.io)).toBe(1);
    expect(empty.runs).toHaveLength(1);
  });

  it("doesn't rerun past the limit", () => {
    const many = Array.from({ length: MAX_RERUN_FILES + 1 }, (_, i) => `f${i}.test.ts`);
    const f = fake({ codes: [1], texts: { [OUT]: report(many) } });
    expect(runStep(ARGS, f.io)).toBe(1);
    expect(f.runs).toHaveLength(1);
    expect(f.lines.at(-1)).toMatch(/not rerunning/);
  });

  it("reads a broken report as no failed files", () => {
    expect(failedFiles("not json", "/w")).toEqual([]);
    expect(failedFiles(null, "/w")).toEqual([]);
  });

  it.each([
    [["--project", "web:components"], "components"],
    [["--project", "tooling:browser"], "browser-tooling"],
    [["--project", "integration"], "integration"],
    [["--project", "data:unit", "--project", "tooling:unit"], "unit"],
  ])("%j owns the %s files", (args, group) => {
    expect(stepGroup(args)).toBe(group);
  });
});

describe("a narrowed step", () => {
  const narrowed = JSON.stringify({ target: "t", files: ["a.test.ts", "b.int.test.ts"] });

  it("runs only its own files, with no shard", () => {
    const f = fake({ texts: { ".ci-narrowed.json": narrowed } });
    expect(runStep(ARGS, f.io)).toBe(0);
    expect(f.runs[0]?.args.at(-1)).toBe("a.test.ts");
    expect(f.runs[0]?.args).not.toContain("b.int.test.ts");
    expect(f.runs[0]?.args.some((a) => a.startsWith("--shard"))).toBe(false);
  });

  it("runs nothing when none of the files are its own", () => {
    const f = fake({
      texts: { ".ci-narrowed.json": JSON.stringify({ target: "t", files: ["b.int.test.ts"] }) },
    });
    expect(runStep(ARGS, f.io)).toBe(0);
    expect(f.runs).toEqual([]);
  });

  it("runs no quarantine", () => {
    const f = fake({
      texts: { ".ci-narrowed.json": narrowed, "scripts/ci/quarantine.txt": "a.test.ts\tn\tB-1\n" },
    });
    expect(runQuarantine(ARGS, f.io)).toBe(0);
    expect(f.runs).toEqual([]);
  });
});

describe("a quarantine step", () => {
  const list = "a.test.ts\tone\tB-1\na.test.ts\ttwo\tB-2\nb.int.test.ts\tthree\tB-3\n";

  it("runs its own listed files in quarantine mode, and can't fail", () => {
    const f = fake({ codes: [1], texts: { "scripts/ci/quarantine.txt": list } });
    expect(runQuarantine(ARGS, f.io)).toBe(0);
    expect(f.runs).toHaveLength(1);
    expect(f.runs[0]?.env).toEqual({ CARETOOK_QUARANTINE: "run" });
    expect(f.runs[0]?.args).toContain("--outputFile.json=ci-results/unit.quarantine.json");
    expect(f.runs[0]?.args.at(-1)).toBe("a.test.ts");
    expect(f.runs[0]?.args).not.toContain("b.int.test.ts");
  });

  it("runs nothing with an empty list", () => {
    const f = fake({ texts: { "scripts/ci/quarantine.txt": "# header\n" } });
    expect(runQuarantine(ARGS, f.io)).toBe(0);
    expect(f.runs).toEqual([]);
  });
});
