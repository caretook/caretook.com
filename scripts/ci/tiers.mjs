// The CI tiers: one list, read by the workflow, `pnpm prd ci` and (later) the
// check plan and the landing gate. Each tier includes the ones before it. A ref
// `ci/<tier>/<name>` asks for a tier.
//
//   node scripts/ci/tiers.mjs <ref name>   the workflow's plan job: prints
//   `tier=…` and one `<job>=true|false` per job, for $GITHUB_OUTPUT.
//   Runs on the bare runner's Node before any install, so it imports nothing.

export const TIERS = /** @type {const} */ (["static", "unit", "integration", "components", "full"]);

/** The job each tier adds. `full` adds the build job. */
export const TIER_JOBS = /** @type {const} */ ({
  static: "static",
  unit: "unit",
  integration: "integration",
  components: "components",
  full: "build",
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
  return { jobs: asked.map((t) => TIER_JOBS[t]), ranTier: tier };
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
 * The plan job's outputs for a ref name.
 * @param {string} ref
 */
export function planOutputs(ref) {
  const parsed = parseCiRef(ref);
  if (!parsed) throw new Error(`not a ci/<tier>/<name> ref: ${ref}`);
  const jobs = /** @type {readonly string[]} */ (jobsFor(parsed.tier).jobs);
  return [`tier=${parsed.tier}`, ...TIERS.map((t) => `${TIER_JOBS[t]}=${jobs.includes(TIER_JOBS[t])}`)];
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    console.log(planOutputs(process.argv[2] ?? "").join("\n"));
  } catch (e) {
    console.error(/** @type {Error} */ (e).message);
    process.exit(1);
  }
}
