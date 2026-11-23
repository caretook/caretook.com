// The CI tiers: one list, read by the workflow, `pnpm prd ci` and (later) the
// check plan and the landing gate. Each tier includes the ones before it. A ref
// `ci/<tier>/<name>` asks for a tier.
//
//   node scripts/ci/tiers.mjs <ref name>   the workflow's plan job: prints
//   `tier=…` and one `<tier>=true|false` per tier, for $GITHUB_OUTPUT. A commit
//   carrying .ci-narrowed.json starts only the jobs of its files.
//   Runs on the bare runner's Node before any install: Node's own modules only.
import { existsSync, readFileSync } from "node:fs";

export const TIERS = /** @type {const} */ ([
  "static",
  "unit",
  "integration",
  "components",
  "full",
  "candidate",
  "release",
]);

/**
 * The jobs each tier adds. The component tests are two shards, since one job ran
 * past the 10-minute limit (13 minutes); `full` adds the build job and
 * `candidate` the browser suite on the Docker stack. `release` adds two more suite
 * runs and the second zone. Each suite run is its own job: one job's 35-minute limit
 * holds one suite (its caps total about 26 minutes).
 */
export const TIER_JOBS = /** @type {const} */ ({
  static: ["static"],
  unit: ["unit"],
  integration: ["integration"],
  components: ["components-1", "components-2"],
  full: ["build"],
  candidate: ["browser"],
  release: ["browser-2", "browser-3", "zone-components-1", "zone-components-2", "zone-browser"],
});

/** @param {string} tier */
export const isTier = (tier) => /** @type {readonly string[]} */ (TIERS).includes(tier);

/**
 * The jobs a tier runs: its own and those of every tier before it.
 * @param {string} tier
 */
export function jobsFor(tier) {
  if (!isTier(tier)) throw new Error(`unknown tier "${tier}" (${TIERS.join(", ")})`);
  const asked = TIERS.slice(0, TIERS.indexOf(/** @type {(typeof TIERS)[number]} */ (tier)) + 1);
  return { jobs: asked.flatMap((t) => [...TIER_JOBS[t]]), ranTier: tier };
}

/** The file list a narrowed run's throwaway commit adds, at the repo root. */
export const NARROWED_FILE = ".ci-narrowed.json";
/**
 * The marker of a proof run (`ci run candidate --force-flake <check>`), only ever
 * in that run's throwaway commit: its check fails once. Its verdict is never a gate.
 * Under .github/, which check-areas already covers: the run's own lint test reads
 * every tracked file, and a new root file would fail it.
 */
export const FORCED_FLAKE_FILE = ".github/ci-force-flake.json";

const BROWSER_CHECKS = "scripts/browser-checks/";
/** A browser check's spec: its identity in a verdict, the brake list and a filing. */
export const browserCheckFile = (/** @type {string} */ check) => `${BROWSER_CHECKS}${check}.spec.mjs`;
export const isBrowserCheckFile = (/** @type {string} */ file) =>
  file.startsWith(BROWSER_CHECKS) && file.endsWith(".spec.mjs");

/**
 * Which step runs a test file: `unit`, `integration`, `browser-tooling` (in the
 * integration job), `components` or `browser` (a browser check's spec).
 * @param {string} file
 */
export function fileGroup(file) {
  if (isBrowserCheckFile(file)) return "browser";
  if (file === "scripts/loops/browser.test.mjs") return "browser-tooling";
  if (file.endsWith(".int.test.ts")) return "integration";
  if (file.endsWith(".browser.test.tsx")) return "components";
  return "unit";
}

const GROUP_TIER = /** @type {const} */ ({
  unit: "unit",
  integration: "integration",
  "browser-tooling": "integration",
  components: "components",
  browser: "candidate",
});

/**
 * The lowest tier that runs a test file.
 * @param {string} file
 */
export const fileTier = (file) => GROUP_TIER[/** @type {keyof typeof GROUP_TIER} */ (fileGroup(file))];

/**
 * The jobs a narrowed run starts: only its files', the components in one job.
 * @param {string[]} files
 */
export function narrowedJobs(files) {
  const tiers = new Set(files.map(fileTier));
  return [
    ...(tiers.has("unit") ? ["unit"] : []),
    ...(tiers.has("integration") ? ["integration"] : []),
    ...(tiers.has("components") ? ["components-1"] : []),
  ];
}

/**
 * The ref a requested run is pushed to.
 * @param {string} tier
 * @param {string} branch
 */
export function ciRefName(tier, branch) {
  if (!isTier(tier)) throw new Error(`unknown tier "${tier}" (${TIERS.join(", ")})`);
  const name = branch.replace(/^refs\/heads\//, "").replaceAll("/", "-");
  if (!name) throw new Error("a CI ref needs a branch name");
  return `ci/${tier}/${name}`;
}

/**
 * The tier and name in a `ci/<tier>/<name>` ref, or null.
 * @param {string} ref
 */
export function parseCiRef(ref) {
  const m = /^(?:refs\/heads\/)?ci\/([^/]+)\/(.+)$/.exec(ref);
  return m && isTier(m[1]) ? { tier: m[1], name: m[2] } : null;
}

/**
 * The plan job's outputs for a ref name, and a narrowed run's files if any.
 * `components2` is the second shard: a narrowed run has one components job.
 * @param {string} ref
 * @param {string[] | null} [narrowed]
 */
export function planOutputs(ref, narrowed = null) {
  const parsed = parseCiRef(ref);
  if (!parsed) throw new Error(`not a ci/<tier>/<name> ref: ${ref}`);
  if (narrowed) {
    const jobs = narrowedJobs(narrowed);
    return [
      `tier=${parsed.tier}`,
      "static=false",
      `unit=${jobs.includes("unit")}`,
      `integration=${jobs.includes("integration")}`,
      `components=${jobs.includes("components-1")}`,
      "full=false",
      "candidate=false",
      "release=false",
      "components2=false",
      "narrowed=true",
    ];
  }
  const upTo = TIERS.indexOf(/** @type {(typeof TIERS)[number]} */ (parsed.tier));
  return [
    `tier=${parsed.tier}`,
    ...TIERS.map((t, i) => `${t}=${i <= upTo}`),
    `components2=${upTo >= TIERS.indexOf("components")}`,
    "narrowed=false",
  ];
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const narrowed = existsSync(NARROWED_FILE) ? JSON.parse(readFileSync(NARROWED_FILE, "utf8")).files : null;
    console.log(planOutputs(process.argv[2] ?? "", narrowed).join("\n"));
  } catch (e) {
    console.error(/** @type {Error} */ (e).message);
    process.exit(1);
  }
}
