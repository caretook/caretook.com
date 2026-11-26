// CI's browser job against a fake plain runner: a check per call at its cap, the one
// rerun, what reads as a flake, the shared time budget, and a proof run's forced failure.
import { describe, expect, it } from "vitest";

import {
  BUDGET_S,
  checkCaps,
  FIRST_RESULTS,
  RERUN_RESULTS,
  parseResults,
  runBrowserJob,
  suiteChecks,
  summarizeBrowser,
  toRerun,
} from "./browser-job.mjs";
import { parseBrakeList } from "./lists.mjs";
import { FORCED_FLAKE_FILE } from "./tiers.mjs";
import { buildVerdict } from "./verdict.mjs";

const MANIFEST = "# check cap never e2e\nsign-in 120 no yes\nroundtrip 120 no yes\nold 120 no no\n";
const SIGN_IN = "scripts/browser-checks/sign-in.spec.mjs";
const ROUNDTRIP = "scripts/browser-checks/roundtrip.spec.mjs";
const lines = (/** @type {[string, string, number?][]} */ rows) =>
  rows.map(([c, v, r = 0]) => `${c}\t${v}\t${r}\n`).join("");

/**
 * A fake runner: each call runs one check, its verdict the next of `verdicts[check]`
 * (pass when none is left), appended to the results file it was told.
 */
function fake(/** @type {Record<string, string[]>} */ verdicts, { files = {}, tick = 0 } = {}) {
  /** @type {Record<string, string>} */
  const disk = { "scripts/loops/checks": MANIFEST, [SIGN_IN]: "spec\n", ...files };
  /** @type {{ args: string[], spec: string | undefined }[]} */ const runs = [];
  /** @type {string[]} */ const logged = [];
  /** @type {Record<string, number>} */ const tries = {};
  let time = 0;
  const io = {
    root: "/w",
    run(/** @type {string[]} */ args) {
      runs.push({ args, spec: disk[SIGN_IN] });
      const path = /** @type {string} */ (args[args.indexOf("--results") + 1]).replace("/w/", "");
      const check = /** @type {string} */ (args.at(-1));
      const n = (tries[check] = (tries[check] ?? 0) + 1);
      disk[path] = `${disk[path] ?? ""}${check}\t${verdicts[check]?.[n - 1] ?? "pass"}\t0\n`;
      time += tick;
      return 0;
    },
    readText: (/** @type {string} */ p) => disk[p] ?? null,
    writeText: (/** @type {string} */ p, /** @type {string} */ t) => {
      disk[p] = t;
    },
    remove: (/** @type {string} */ p) => {
      delete disk[p];
    },
    log: (/** @type {string} */ l) => logged.push(l),
    now: () => time,
    pause: () => {},
  };
  return { io, runs, disk, logged };
}

const ok = { result: "success" };
const verdictOf = (/** @type {object} */ summary, result = "success") =>
  buildVerdict({
    commit: "c".repeat(40),
    runId: "1",
    tier: "candidate",
    brakes: parseBrakeList("check:roundtrip\n"),
    needs: {
      plan: ok,
      static: ok,
      "unit-1": ok,
      "unit-2": ok,
      integration: ok,
      "components-1": ok,
      "components-2": ok,
      "components-3": ok,
      build: ok,
      browser: { result, outputs: { started: "true", failures: JSON.stringify(summary) } },
    },
  });
const summary = (
  /** @type {[string, string, number?][]} */ first,
  /** @type {[string, string][]} */ rerun = [],
) => summarizeBrowser(["sign-in", "roundtrip"], parseResults(lines(first)), parseResults(lines(rerun)));

describe("the manifest and the runner's lines", () => {
  it("takes the suite's checks in order, and every check's cap", () => {
    expect(suiteChecks(MANIFEST)).toEqual(["sign-in", "roundtrip"]);
    expect([...checkCaps(MANIFEST)]).toEqual([
      ["sign-in", 120],
      ["roundtrip", 120],
      ["old", 120],
    ]);
  });

  it("reads a result line, and reruns only a failure the runner hasn't retried", () => {
    const first = parseResults(
      lines([
        ["a", "pass"],
        ["b", "FAIL"],
        ["c", "TIMEOUT"],
        ["d", "FAIL", 1],
        ["e", "FLAKY", 1],
        ["f", "MISSING"],
        ["g", "NOT-RUN"],
      ]),
    );
    expect(first.get("d")).toEqual({ check: "d", verdict: "FAIL", retried: true });
    expect(toRerun(first)).toEqual(["b", "c"]);
  });
});

describe("a check's result in the verdict", () => {
  it("a pass is green, by name", () => {
    const v = verdictOf(
      summary([
        ["sign-in", "pass"],
        ["roundtrip", "pass"],
      ]),
    );
    expect(v.kind).toBe("green");
    expect(v.browser).toEqual([
      { check: "sign-in", result: "pass" },
      { check: "roundtrip", result: "pass" },
    ]);
  });

  it("a failure on the rerun too is file, naming the check", () => {
    const v = verdictOf(
      summary(
        [
          ["sign-in", "FAIL"],
          ["roundtrip", "pass"],
        ],
        [["sign-in", "FAIL"]],
      ),
      "failure",
    );
    expect(v.kind).toBe("file");
    expect(v.failed.files).toEqual([SIGN_IN]);
    expect(v.failed.unnamedJobs).toEqual([]);
    expect(v.browser?.[0]).toEqual({ check: "sign-in", result: "fail" });
  });

  it("a failure on a brake-list check is a brake", () => {
    const v = verdictOf(
      summary(
        [
          ["sign-in", "pass"],
          ["roundtrip", "FAIL"],
        ],
        [["roundtrip", "TIMEOUT"]],
      ),
      "failure",
    );
    expect(v.kind).toBe("brake");
    expect(v.brake.files).toEqual([ROUNDTRIP]);
  });

  it("a pass on the rerun is a flake, off the brake list", () => {
    const v = verdictOf(
      summary(
        [
          ["sign-in", "FAIL"],
          ["roundtrip", "pass"],
        ],
        [["sign-in", "pass"]],
      ),
    );
    expect(v.kind).toBe("flake");
    expect(v.flaky).toEqual([{ job: "browser", file: SIGN_IN, name: null, brake: false }]);
  });

  it("the runner's FLAKY is a flake, marked when the check is on the brake list", () => {
    const v = verdictOf(
      summary([
        ["sign-in", "pass"],
        ["roundtrip", "FLAKY", 1],
      ]),
    );
    expect(v.kind).toBe("flake");
    expect(v.flaky).toEqual([{ job: "browser", file: ROUNDTRIP, name: null, brake: true }]);
  });

  it("a check the job never reached is infra, even beside a flake", () => {
    const v = verdictOf(
      summary(
        [
          ["sign-in", "FAIL"],
          ["roundtrip", "NOT-RUN"],
        ],
        [["sign-in", "pass"]],
      ),
      "failure",
    );
    expect(v.kind).toBe("infra");
    expect(v.infra.notRun).toEqual(["roundtrip"]);
  });

  it("a rerun that never reached the check leaves it failing", () => {
    const s = summary(
      [
        ["sign-in", "FAIL"],
        ["roundtrip", "pass"],
      ],
      [["sign-in", "NOT-RUN"]],
    );
    expect(s.rerun?.files).toEqual([SIGN_IN]);
  });
});

describe("the job", () => {
  const run = (/** @type {string} */ results, /** @type {number} */ cap, /** @type {string} */ check) => [
    "run",
    "--results",
    `/w/${results}`,
    "--timeout",
    String(cap),
    check,
  ];

  it("runs each suite check once through the plain runner, at its cap, when they pass", () => {
    const f = fake({});
    expect(runBrowserJob(f.io)).toBe(0);
    expect(f.runs.map((r) => r.args)).toEqual([
      run(FIRST_RESULTS, 120, "sign-in"),
      run(FIRST_RESULTS, 120, "roundtrip"),
    ]);
    expect(f.disk[FIRST_RESULTS]).toBe("sign-in\tpass\t0\nroundtrip\tpass\t0\n");
  });

  it("reruns only the failed check, once, and passes on a flake", () => {
    const f = fake({ "sign-in": ["FAIL", "pass"] }, { tick: 100_000 });
    expect(runBrowserJob(f.io)).toBe(0);
    expect(f.runs).toHaveLength(3);
    expect(f.runs[2]?.args).toEqual(run(RERUN_RESULTS, 120, "sign-in"));
  });

  it("ends a check at what's left of the budget when that's less than its cap", () => {
    const f = fake({}, { tick: (BUDGET_S - 50) * 1000 });
    expect(runBrowserJob(f.io)).toBe(0);
    expect(f.runs[1]?.args).toEqual(run(FIRST_RESULTS, 50, "roundtrip"));
  });

  it("fails when the rerun fails too", () => {
    const f = fake({ "sign-in": ["FAIL", "FAIL"] });
    expect(runBrowserJob(f.io)).toBe(1);
  });

  it("skips the rerun with no time left, and the check stays failed", () => {
    const f = fake({ "sign-in": ["FAIL"] }, { tick: (BUDGET_S / 2) * 1000 });
    expect(runBrowserJob(f.io)).toBe(1);
    expect(f.runs).toHaveLength(2);
    expect(f.logged.join("\n")).toContain("not rerunning sign-in");
  });

  it("records a check the budget never reaches as not run, and fails", () => {
    const f = fake({}, { tick: BUDGET_S * 1000 });
    expect(runBrowserJob(f.io)).toBe(1);
    expect(f.runs).toHaveLength(1);
    expect(f.disk[FIRST_RESULTS]).toBe("sign-in\tpass\t0\nroundtrip\tNOT-RUN\t0\n");
  });

  it("drops an earlier attempt's results", () => {
    const f = fake({}, { files: { [RERUN_RESULTS]: lines([["sign-in", "FAIL"]]) } });
    runBrowserJob(f.io);
    expect(f.disk[RERUN_RESULTS]).toBeUndefined();
  });
});

describe("a proof run", () => {
  const marker = { [FORCED_FLAKE_FILE]: JSON.stringify({ check: "sign-in" }) };

  it("leaves every spec alone without the marker", () => {
    const f = fake({ "sign-in": ["FAIL", "pass"] });
    runBrowserJob(f.io);
    expect(f.runs.map((r) => r.spec)).toEqual(["spec\n", "spec\n", "spec\n"]);
  });

  it("breaks the check for the first pass only, and reads as a flake", () => {
    const f = fake({ "sign-in": ["FAIL", "pass"] }, { files: marker });
    expect(runBrowserJob(f.io)).toBe(0);
    expect(f.runs[0]?.spec).toMatch(/^throw new Error\("forced failure/);
    expect(f.runs[1]?.spec).toMatch(/^throw new Error\("forced failure/);
    expect(f.runs[2]?.spec).toBe("spec\n");
    expect(f.disk[SIGN_IN]).toBe("spec\n");
  });

  it("restores the spec when the first pass throws", () => {
    const f = fake({}, { files: marker });
    f.io.run = () => {
      throw new Error("the runner died");
    };
    expect(() => runBrowserJob(f.io)).toThrow("the runner died");
    expect(f.disk[SIGN_IN]).toBe("spec\n");
  });

  it("refuses a marker naming a check outside the suite", () => {
    const f = fake({}, { files: { [FORCED_FLAKE_FILE]: JSON.stringify({ check: "old" }) } });
    expect(() => runBrowserJob(f.io)).toThrow(/isn't in the suite/);
    expect(f.runs).toHaveLength(0);
  });
});
