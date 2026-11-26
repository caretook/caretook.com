// The CI tiers, Caretook's reader of its tier data (tiers.json, beside this file;
// risa.json's paths.tierData names the same file, and tiers.test.mjs keeps the two
// equal). The core reads the data through its own reader (tier-data.mjs) and the
// config; this one reads it at its fixed path, since the workflow's plan job runs
// it on the bare runner's Node before any install: Node's own modules only, no
// config loader. Each tier includes the ones before it. A ref `ci/<tier>/<name>`
// (the data's refPrefix) asks for a tier.
//
//   node scripts/ci/tiers.mjs <ref name>   the workflow's plan job: prints
//   `tier=…` and one `<tier>=true|false` per tier, for $GITHUB_OUTPUT. A commit
//   carrying .ci-narrowed.json starts only the jobs of its files.
//
// The data: `tiers` (names, lowest first); `jobs` (the jobs each tier adds); `fileGroups`
// (which step runs a test file: the first whose `pattern` matches, `*` matching
// anything, `/` too, and the lowest tier that runs it); `narrowedTiers` (the tiers
// whose first job a narrowed run starts); `browserCheck` (a browser check's spec,
// `*` its name); the two marker files `narrowedFile` and `forcedFlakeFile`; `refPrefix`.
//
// Why the jobs are what they are: the component tests are three shards, since one
// job ran past the 10-minute limit (13 minutes) and two ran 12–15 with the second
// zone; `full` adds the build job and `candidate` the browser suite on the Docker
// stack. `release` adds two more suite runs and the second zone. Each suite run is
// its own job: one job's 35-minute limit holds one suite (its caps total about 26
// minutes). The forced-flake marker (`ci run candidate --force-flake <check>`) is
// only ever in a proof run's throwaway commit: its check fails once, and its
// verdict is never a gate. It sits under .github/, which check-areas already
// covers: the run's own lint test reads every tracked file, and a new root file
// would fail it.
import { existsSync, readFileSync } from "node:fs";

/** Where the tier data is, from the repo's root: risa.json's paths.tierData. */
export const TIER_DATA = "scripts/ci/tiers.json";

const DATA = JSON.parse(readFileSync(new URL("./tiers.json", import.meta.url), "utf8"));

/** @type {readonly string[]} */
export const TIERS = DATA.tiers;

/** The jobs each tier adds. @type {Record<string, readonly string[]>} */
export const TIER_JOBS = DATA.jobs;

/** @param {string} tier */
export const isTier = (tier) => TIERS.includes(tier);

const unknownTier = (/** @type {string} */ tier) => new Error(`unknown tier "${tier}" (${TIERS.join(", ")})`);

/**
 * The jobs a tier runs: its own and those of every tier before it.
 * @param {string} tier
 */
export function jobsFor(tier) {
  if (!isTier(tier)) throw unknownTier(tier);
  const asked = TIERS.slice(0, TIERS.indexOf(tier) + 1);
  return { jobs: asked.flatMap((t) => [...(TIER_JOBS[t] ?? [])]), ranTier: tier };
}

/** The file list a narrowed run's throwaway commit adds, at the repo root. */
export const NARROWED_FILE = /** @type {string} */ (DATA.narrowedFile);
/** The marker of a proof run, only ever in that run's throwaway commit. */
export const FORCED_FLAKE_FILE = /** @type {string} */ (DATA.forcedFlakeFile);

/** A pattern whose `*` matches anything, `/` too. @param {string} pattern */
const glob = (pattern) =>
  new RegExp(
    `^${pattern
      .split("*")
      .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
      .join(".*")}$`,
  );

const [CHECK_HEAD, CHECK_TAIL] = /** @type {[string, string]} */ (DATA.browserCheck.split("*"));
const CHECK = glob(DATA.browserCheck);
/** A browser check's spec: its identity in a verdict, the brake list and a filing. */
export const browserCheckFile = (/** @type {string} */ check) => `${CHECK_HEAD}${check}${CHECK_TAIL}`;
export const isBrowserCheckFile = (/** @type {string} */ file) => CHECK.test(file);

/** @type {{ group: string, re: RegExp, tier: string }[]} */
const GROUPS = DATA.fileGroups.map((/** @type {{ group: string, pattern: string, tier: string }} */ g) => ({
  group: g.group,
  re: glob(g.pattern),
  tier: g.tier,
}));
const groupOf = (/** @type {string} */ file) => GROUPS.find((g) => g.re.test(file));

/**
 * Which step runs a test file: `unit`, `integration`, `browser-tooling` (in the
 * integration job), `components` or `browser` (a browser check's spec).
 * @param {string} file
 */
export const fileGroup = (file) => groupOf(file)?.group;

/**
 * The lowest tier that runs a test file.
 * @param {string} file
 */
export const fileTier = (file) => groupOf(file)?.tier;

/**
 * The jobs a narrowed run starts: only its files', the components in one job.
 * @param {string[]} files
 */
export function narrowedJobs(files) {
  const tiers = new Set(files.map(fileTier));
  return DATA.narrowedTiers
    .filter((/** @type {string} */ t) => tiers.has(t))
    .map((/** @type {string} */ t) => TIER_JOBS[t]?.[0]);
}

const PREFIX = /** @type {string} */ (DATA.refPrefix);
const REF = new RegExp(
  `^(?:refs\\/heads\\/)?${PREFIX.replace(/[.+?^${}()|[\]\\/]/g, "\\$&")}([^/]+)\\/(.+)$`,
);

/**
 * The ref a requested run is pushed to.
 * @param {string} tier
 * @param {string} branch
 */
export function ciRefName(tier, branch) {
  if (!isTier(tier)) throw unknownTier(tier);
  const name = branch.replace(/^refs\/heads\//, "").replaceAll("/", "-");
  if (!name) throw new Error("a CI ref needs a branch name");
  return `${PREFIX}${tier}/${name}`;
}

/**
 * The tier and name in a `ci/<tier>/<name>` ref, or null.
 * @param {string} ref
 */
export function parseCiRef(ref) {
  const m = REF.exec(ref);
  return m && isTier(/** @type {string} */ (m[1]))
    ? { tier: /** @type {string} */ (m[1]), name: m[2] }
    : null;
}

/**
 * The plan job's outputs for a ref name, and a narrowed run's files if any.
 * `components2` is the second and third shards: a narrowed run has one components job.
 * @param {string} ref
 * @param {string[] | null} [narrowed]
 */
export function planOutputs(ref, narrowed = null) {
  const parsed = parseCiRef(ref);
  if (!parsed) throw new Error(`not a ${PREFIX}<tier>/<name> ref: ${ref}`);
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
  const upTo = TIERS.indexOf(parsed.tier);
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
