// A CI test step against a fake Vitest: the one rerun of the failed files, what a
// narrowed run keeps, a quarantine step that can't fail, and a timed step's gate
// on a fake clock. Fictional file names and times only.
import { describe, expect, it } from "vitest";

import ProgressReporter, { hungFiles, progressFileOf } from "./progress-reporter.mjs";
import {
  MAX_RERUN_FILES,
  failedFiles,
  fileTimes,
  runQuarantine,
  runStep,
  stepGroup,
  withProgress,
} from "./test-job.mjs";

const OUT = "ci-results/unit.json";
const ARGS = ["--project", "data:unit", "--shard=1/2", "--reporter=json", `--outputFile.json=${OUT}`];
const report = (/** @type {string[]} */ files) =>
  JSON.stringify({
    testResults: files.map((f) => ({ name: `/w/${f}`, status: "failed", assertionResults: [] })),
  });

/** The gates' data as the core fills it in: every measure at its defaults, those given armed. */
const gatesWith = (/** @type {any} */ data) => {
  const armed = Object.keys(data?.measures ?? {});
  const limits = (/** @type {string} */ m) => ({ aim: 300, cutoff: 360, armed: armed.includes(m) });
  return {
    quietLoadPerCore: 1,
    measures: { unit: limits("unit"), components: limits("components"), quick: limits("quick") },
    localModes: ["quick", "slice"],
  };
};

function fake({
  codes = [0],
  texts = /** @type {Record<string, string>} */ ({}),
  seconds = /** @type {number[]} */ ([]),
  gates = gatesWith(undefined),
} = {}) {
  /** @type {{ args: string[], env: Record<string, string> }[]} */ const runs = [];
  /** @type {string[]} */ const lines = [];
  /** @type {Record<string, string>} */ const written = {};
  /** @type {string[]} */ const summary = [];
  let clock = 1_000_000;
  const io = {
    run(/** @type {string[]} */ args, /** @type {Record<string, string>} */ env) {
      runs.push({ args, env });
      clock += (seconds[runs.length - 1] ?? 1) * 1000;
      return codes[runs.length - 1] ?? 0;
    },
    readText: (/** @type {string} */ p) => texts[p] ?? null,
    log: (/** @type {string} */ l) => lines.push(l),
    root: "/w",
    now: () => clock,
    gates: () => gates,
    write: (/** @type {string} */ p, /** @type {string} */ t) => void (written[p] = t),
    summary: (/** @type {string} */ t) => void summary.push(t),
  };
  return { io, runs, lines, written, summary };
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

  it("runs the quarantined tests of its own named files, and no others (B-587)", () => {
    const f = fake({
      codes: [1],
      texts: {
        ".ci-narrowed.json": narrowed,
        "scripts/ci/quarantine.txt": "a.test.ts\tn\tB-1\nc.test.ts\tm\tB-2\nb.int.test.ts\to\tB-3\n",
      },
    });
    expect(runQuarantine(ARGS, f.io)).toBe(0);
    expect(f.runs).toHaveLength(1);
    expect(f.runs[0]?.env).toEqual({ CARETOOK_QUARANTINE: "run" });
    expect(f.runs[0]?.args.at(-1)).toBe("a.test.ts");
    expect(f.runs[0]?.args).not.toContain("c.test.ts");
    expect(f.runs[0]?.args).not.toContain("b.int.test.ts");
  });

  it("runs no quarantine when none of its named files has an entry", () => {
    const f = fake({
      texts: { ".ci-narrowed.json": narrowed, "scripts/ci/quarantine.txt": "c.test.ts\tn\tB-1\n" },
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

describe("a timed step", () => {
  const COMP = "ci-results/components-1.json";
  const TIMED = [
    "--time-gate",
    "--project",
    "web:components",
    "--shard=1/3",
    "--reporter=json",
    `--outputFile.json=${COMP}`,
  ];
  /** A report whose files took 1..n seconds, the last failed when asked. */
  const timedReport = (/** @type {number} */ n, failed = false) =>
    JSON.stringify({
      testResults: Array.from({ length: n }, (_, i) => ({
        name: `/w/apps/web/app/fictional-${i}.browser.test.tsx`,
        status: failed && i === n - 1 ? "failed" : "passed",
        startTime: 5_000,
        endTime: 5_000 + (i + 1) * 1000,
        assertionResults: [],
      })),
    });
  const result = (/** @type {Record<string, string>} */ written) =>
    JSON.parse(/** @type {string} */ (written["ci-results/components-1.time.json"]));

  it("writes warn with its slowest files for a passing 330 s components step, and passes", () => {
    const f = fake({ seconds: [330], texts: { [COMP]: timedReport(12) } });
    expect(runStep(TIMED, f.io)).toBe(0);
    expect(f.runs[0]?.args).not.toContain("--time-gate");
    const r = result(f.written);
    expect(r).toMatchObject({ measure: "components", seconds: 330, verdict: "warn", armed: false });
    const files = r.lines.filter((/** @type {string} */ l) => l.includes("fictional-"));
    expect(files).toHaveLength(10);
    expect(files[0]).toMatch(/12 s {2}apps\/web\/app\/fictional-11\.browser\.test\.tsx$/);
    expect(f.summary.join("")).toContain("### Time gate: components, 330 s, warn");
    expect(f.lines).toContain(r.lines[0]);
  });

  it("fails an armed breach with `time`, every test passing", () => {
    const gates = gatesWith({ measures: { components: { armed: true } } });
    const f = fake({ seconds: [400], texts: { [COMP]: timedReport(3) }, gates });
    expect(runStep(TIMED, f.io)).not.toBe(0);
    expect(result(f.written)).toMatchObject({ seconds: 400, verdict: "fail", armed: true });
    expect(f.lines.at(-1)).toMatch(/^time: the components step took 400 s, past its armed cutoff of 360 s$/);
    expect(f.runs).toHaveLength(1);
  });

  it("an unarmed breach past the cutoff only warns, saying so", () => {
    const f = fake({ seconds: [400], texts: { [COMP]: timedReport(3) } });
    expect(runStep(TIMED, f.io)).toBe(0);
    expect(result(f.written).lines[0]).toContain("not armed");
  });

  it("doesn't count a failing step's rerun", () => {
    const gates = gatesWith({ measures: { components: { armed: true } } });
    const f = fake({ codes: [1, 0], seconds: [200, 500], texts: { [COMP]: timedReport(3, true) }, gates });
    expect(runStep(TIMED, f.io)).toBe(0);
    expect(f.runs).toHaveLength(2);
    expect(result(f.written)).toMatchObject({ seconds: 200, verdict: "ok" });
  });

  it("keeps a test failure's code over the time", () => {
    const gates = gatesWith({ measures: { components: { armed: true } } });
    const f = fake({ codes: [3, 1], seconds: [400, 10], texts: { [COMP]: timedReport(3, true) }, gates });
    expect(runStep(TIMED, f.io)).toBe(3);
    expect(result(f.written).verdict).toBe("fail");
  });

  it("times the unit step as the unit measure", () => {
    const f = fake({ seconds: [100] });
    expect(runStep(["--time-gate", ...ARGS], f.io)).toBe(0);
    expect(JSON.parse(/** @type {string} */ (f.written["ci-results/unit.time.json"]))).toMatchObject({
      measure: "unit",
      verdict: "ok",
    });
  });

  it("isn't timed without the flag, on a group with no measure, or on a narrowed run", () => {
    const plain = fake({ seconds: [999] });
    runStep(ARGS, plain.io);
    expect(plain.written).toEqual({});
    const integration = fake({ seconds: [999] });
    runStep(["--time-gate", "--project", "integration", `--outputFile.json=${OUT}`], integration.io);
    expect(integration.written).toEqual({});
    const narrowed = fake({
      seconds: [999],
      texts: { ".ci-narrowed.json": JSON.stringify({ target: "t", files: ["a.test.ts"] }) },
    });
    expect(runStep(["--time-gate", ...ARGS], narrowed.io)).toBe(0);
    expect(narrowed.written).toEqual({});
  });

  it("isn't judged when the gates' data can't be read, and the step still passes", () => {
    const f = fake({ seconds: [999] });
    f.io.gates = () => {
      throw new Error("broken");
    };
    expect(runStep(TIMED, f.io)).toBe(0);
    expect(f.written).toEqual({});
    expect(f.lines[0]).toMatch(/not judged \(broken\)/);
  });

  it("reads each file's seconds from a report, skipping one with no times", () => {
    const text = JSON.stringify({
      testResults: [{ name: "/w/a.test.ts", startTime: 1000, endTime: 3500 }, { name: "/w/b.test.ts" }],
    });
    expect(fileTimes(text, "/w")).toEqual([{ name: "a.test.ts", seconds: 2.5 }]);
    expect(fileTimes("not json", "/w")).toEqual([]);
  });
});

describe("a run's progress", () => {
  it("adds the progress reporter beside the step's own, writing beside its report", () => {
    const { args, env } = withProgress(ARGS);
    expect(args[0]).toMatch(/--reporter=.*progress-reporter\.mjs$/);
    expect(args.slice(1)).toEqual(ARGS);
    expect(env).toEqual({ CARETOOK_CI_PROGRESS: "ci-results/unit.progress.json" });
    expect(progressFileOf("ci-results/c.rerun.json")).toBe("ci-results/c.rerun.progress.json");
  });

  it("keeps the default reporter for a run that names none", () => {
    const { args } = withProgress(["--project", "x", `--outputFile.json=${OUT}`]);
    expect(args[1]).toBe("--reporter=default");
  });

  function reporter(limitSeconds = 300) {
    /** @type {Record<string, any>} */ const written = {};
    /** @type {(() => void)[]} */ const timers = [];
    /** @type {number[]} */ const exits = [];
    /** @type {string[]} */ const lines = [];
    const r = new ProgressReporter({
      path: "r/c.progress.json",
      limitSeconds,
      root: "/w",
      write: (p, t) => void (written[p] = JSON.parse(t)),
      log: (l) => void lines.push(l),
      exit: (c) => void exits.push(c),
      setTimer: (fn) => timers.push(fn) - 1,
      clearTimer: (i) => void (timers[/** @type {number} */ (i)] = () => {}),
    });
    const mod = (/** @type {string} */ f, state = "passed") => ({ moduleId: `/w/${f}`, state: () => state });
    return { r, written, timers, exits, lines, mod, read: () => written["r/c.progress.json"] };
  }

  it("a finished run leaves no file hung", () => {
    const t = reporter();
    t.r.onTestModuleStart(t.mod("a.test.ts"));
    t.r.onTestModuleEnd(t.mod("a.test.ts", "failed"));
    expect(t.read()).toMatchObject({
      started: ["a.test.ts"],
      finished: ["a.test.ts"],
      failed: ["a.test.ts"],
    });
    expect(hungFiles(t.read())).toEqual([]);
    t.timers.forEach((fn) => fn());
    expect(t.exits).toEqual([]);
  });

  it("a file past its limit is named and the run stopped; a killed run's unfinished file is hung", () => {
    const t = reporter();
    t.r.onTestModuleStart(t.mod("a.test.ts"));
    t.r.onTestModuleStart(t.mod("b.test.ts"));
    expect(hungFiles(t.read())).toEqual(["a.test.ts", "b.test.ts"]);
    t.r.onTestModuleEnd(t.mod("a.test.ts"));
    t.timers[1]?.();
    expect(t.read().timedOut).toEqual(["b.test.ts"]);
    expect(hungFiles(t.read())).toEqual(["b.test.ts"]);
    expect(t.exits).toEqual([1]);
    expect(t.lines[0]).toContain("b.test.ts has run past 300 s");
  });

  it("does nothing without a progress file", () => {
    const r = new ProgressReporter({ path: null, write: () => expect.fail("wrote") });
    r.onInit();
    r.onTestModuleStart({ moduleId: "/w/a.test.ts" });
    expect(hungFiles(null)).toEqual([]);
  });
});
