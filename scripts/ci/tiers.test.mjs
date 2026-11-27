// Caretook's tier reader (tiers.mjs, the workflow's plan job): its fixed path is
// the one risa.json names, it uses Node's own modules alone, its CLI prints the
// plan job's lines, and it answers as the core's reader does on the same data.
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterAll, describe, expect, it } from "vitest";

import * as tiers from "./tiers.mjs";
import { tierData } from "risa/ci/tier-data.mjs";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const CLI = fileURLToPath(new URL("./tiers.mjs", import.meta.url));

describe("tiers.mjs", () => {
  // It reads its data at a fixed path (no config loader on the bare runner), so
  // this keeps that path equal to risa.json's paths.tierData.
  it("reads the file the project config names", () => {
    const config = JSON.parse(readFileSync(join(ROOT, "risa.json"), "utf8"));
    expect(tiers.TIER_DATA).toBe(config.paths.tierData);
    expect(fileURLToPath(new URL("./tiers.json", import.meta.url))).toBe(join(ROOT, tiers.TIER_DATA));
  });

  it("imports Node's own modules alone", () => {
    const source = readFileSync(CLI, "utf8");
    const imports = [...source.matchAll(/^import .* from "([^"]+)";$/gm)].map((m) => m[1]);
    expect(imports.length).toBeGreaterThan(0);
    expect(imports.every((m) => m?.startsWith("node:"))).toBe(true);
    expect(source).not.toMatch(/\bimport\(|\brequire\(/);
  });

  const tmp = mkdtempSync(join(tmpdir(), "tiers-cli-"));
  afterAll(() => rmSync(tmp, { recursive: true, force: true }));
  const plan = (/** @type {string} */ ref) =>
    execFileSync("node", [CLI, ref], { cwd: tmp, encoding: "utf8" });

  it("prints the plan job's lines for each tier", () => {
    const want = {
      static: [true, false, false, false, false, false, false, false, false],
      unit: [true, true, false, false, false, false, false, false, true],
      integration: [true, true, true, false, false, false, false, false, true],
      components: [true, true, true, true, false, false, false, true, true],
      full: [true, true, true, true, true, false, false, true, true],
      candidate: [true, true, true, true, true, true, false, true, true],
      release: [true, true, true, true, true, true, true, true, true],
    };
    const keys = [...tiers.TIERS, "components2", "unit2"];
    for (const [tier, on] of Object.entries(want))
      expect(plan(`ci/${tier}/slice-x-1`)).toBe(
        [`tier=${tier}`, ...keys.map((k, i) => `${k}=${on[i]}`), "narrowed=false", ""].join("\n"),
      );
    const r = spawnSync("node", [CLI, "dev"], { cwd: tmp, encoding: "utf8" });
    expect(r.status).toBe(1);
    expect(r.stderr).toBe("not a ci/<tier>/<name> ref: dev\n");
  });

  it("starts only a narrowed commit's jobs", () => {
    const files = ["a.int.test.ts", "b.browser.test.tsx", "scripts/browser-checks/x.spec.mjs"];
    writeFileSync(join(tmp, ".ci-narrowed.json"), JSON.stringify({ files }));
    expect(plan("ci/full/x")).toBe(
      [
        "tier=full",
        "static=false",
        "unit=false",
        "integration=true",
        "components=true",
        "full=false",
        "candidate=false",
        "release=false",
        "components2=false",
        "unit2=false",
        "narrowed=true",
        "",
      ].join("\n"),
    );
    writeFileSync(join(tmp, ".ci-narrowed.json"), JSON.stringify({ files: ["a.test.ts"] }));
    expect(plan("ci/release/x")).toMatch(/^tier=release\nstatic=false\nunit=true\nintegration=false\n/);
    rmSync(join(tmp, ".ci-narrowed.json"));
  });
});

describe("the plan job's outputs", () => {
  const { planOutputs } = tiers;

  it("give the plan job no integration on a unit run", () => {
    expect(planOutputs("ci/unit/x")).toEqual([
      "tier=unit",
      "static=true",
      "unit=true",
      "integration=false",
      "components=false",
      "full=false",
      "candidate=false",
      "release=false",
      "components2=false",
      "unit2=true",
      "narrowed=false",
    ]);
    expect(planOutputs("ci/components/x")).toContain("components=true");
    expect(planOutputs("ci/components/x")).toContain("full=false");
    expect(planOutputs("ci/full/x")).toContain("full=true");
    expect(() => planOutputs("dev")).toThrow(/not a ci/);
  });

  it("start the browser job only on a candidate run, and the release jobs only on a release run", () => {
    expect(planOutputs("ci/full/x")).toContain("candidate=false");
    expect(planOutputs("ci/candidate/x")).toContain("candidate=true");
    expect(planOutputs("ci/candidate/x", ["scripts/ci/tiers.test.mjs"])).toContain("candidate=false");
    expect(planOutputs("ci/candidate/x")).toContain("release=false");
    expect(planOutputs("ci/release/x")).toContain("release=true");
    expect(planOutputs("ci/release/x", ["scripts/ci/tiers.test.mjs"])).toContain("release=false");
  });

  it("start only a narrowed run's files' jobs, the components in one", () => {
    expect(planOutputs("ci/full/x", ["a.int.test.ts"])).toEqual([
      "tier=full",
      "static=false",
      "unit=false",
      "integration=true",
      "components=false",
      "full=false",
      "candidate=false",
      "release=false",
      "components2=false",
      "unit2=false",
      "narrowed=true",
    ]);
  });
});

// The core reads the same file through its own reader: the two must agree on
// every symbol the core takes from tiers.mjs.
describe("the two tier readers", () => {
  const core = tierData();
  // A file for each group's pattern, and some more.
  const DATA = JSON.parse(readFileSync(new URL("./tiers.json", import.meta.url), "utf8"));
  const files = [
    ...DATA.fileGroups.map((/** @type {{ pattern: string }} */ g) => g.pattern.replace("*", "x/y")),
    "a.test.ts",
    "apps/web/app/x.test.ts",
    "packages/data/src/x.int.test.ts",
    "apps/web/app/routes/x.browser.test.tsx",
    "scripts/browser-checks/sign-in.spec.mjs",
    "scripts/browser-checks/fixtures.mjs",
    "scripts/browser-checks.spec.mjs",
    "README.md",
  ];

  it("agree on the tiers, their jobs and the marker files", () => {
    expect(core.TIERS).toEqual(tiers.TIERS);
    expect(core.TIER_JOBS).toEqual(tiers.TIER_JOBS);
    expect(core.NARROWED_FILE).toBe(tiers.NARROWED_FILE);
    expect(core.FORCED_FLAKE_FILE).toBe(tiers.FORCED_FLAKE_FILE);
    for (const t of [...tiers.TIERS, "none", "ci", ""]) {
      expect(core.isTier(t)).toBe(tiers.isTier(t));
      if (tiers.isTier(t)) expect(core.jobsFor(t)).toEqual(tiers.jobsFor(t));
      else
        expect(() => core.jobsFor(t)).toThrow(
          /** @type {Error} */ (catching(() => tiers.jobsFor(t))).message,
        );
    }
  });

  it("agree on each file's group and tier, and a browser check's spec", () => {
    for (const f of files) {
      expect(core.fileGroup(f), f).toBe(tiers.fileGroup(f));
      expect(core.fileTier(f), f).toBe(tiers.fileTier(f));
      expect(core.isBrowserCheckFile(f), f).toBe(tiers.isBrowserCheckFile(f));
    }
    for (const check of ["sign-in", "roundtrip"])
      expect(core.browserCheckFile(check)).toBe(tiers.browserCheckFile(check));
    for (let i = 0; i < files.length; i++)
      expect(core.narrowedJobs(files.slice(i))).toEqual(tiers.narrowedJobs(files.slice(i)));
    expect(core.narrowedJobs([])).toEqual(tiers.narrowedJobs([]));
  });

  it("agree on CI refs", () => {
    for (const t of tiers.TIERS)
      for (const branch of ["dev", "refs/heads/slice/t/2", "prd/x"])
        expect(core.ciRefName(t, branch)).toBe(tiers.ciRefName(t, branch));
    expect(() => core.ciRefName("dev", "x")).toThrow(/unknown tier/);
    expect(() => tiers.ciRefName("dev", "x")).toThrow(/unknown tier/);
    for (const ref of [
      "ci/unit/x",
      "refs/heads/ci/release/a/b",
      "ci/nope/x",
      "ci/unit/",
      "dev",
      "xci/unit/x",
    ])
      expect(core.parseCiRef(ref), ref).toEqual(tiers.parseCiRef(ref));
  });
});

/** The error a call throws. @param {() => unknown} f */
function catching(f) {
  try {
    f();
  } catch (e) {
    return e;
  }
  throw new Error("it didn't throw");
}
