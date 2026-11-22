// The CI tiers: one list, read by the workflow, `pnpm prd ci` and (later) the
// check plan and the landing gate. Each tier includes the ones before it. A ref
// `ci/<tier>/<name>` asks for a tier.
//
//   node scripts/ci/tiers.mjs <ref name>   the workflow's plan job: prints
//   `tier=…`, one `<job>=true|false` per job and `not_built=…`, for $GITHUB_OUTPUT.
//   Runs on the bare runner's Node before any install, so it imports nothing.

export const TIERS = /** @type {const} */ (["static", "unit", "integration", "components", "full"]);

/** The tiers whose jobs exist so far. A higher tier runs these and says the rest isn't built. */
export const BUILT_TIERS = /** @type {const} */ (["static", "unit", "integration"]);

/** @param {string} tier */
export const isTier = (tier) => /** @type {readonly string[]} */ (TIERS).includes(tier);

/**
 * What a tier runs today: the built jobs it includes, the highest of them, and
 * the tiers it asks for that aren't built yet.
 * @param {string} tier
 */
export function jobsFor(tier) {
  if (!isTier(tier)) throw new Error(`unknown tier "${tier}" (${TIERS.join(", ")})`);
  const asked = TIERS.slice(0, TIERS.indexOf(/** @type {(typeof TIERS)[number]} */ (tier)) + 1);
  const jobs = asked.filter((t) => /** @type {readonly string[]} */ (BUILT_TIERS).includes(t));
  return {
    jobs,
    ranTier: jobs[jobs.length - 1],
    notBuilt: asked.filter((t) => !(/** @type {readonly string[]} */ (BUILT_TIERS).includes(t))),
  };
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
  const { jobs, notBuilt } = jobsFor(parsed.tier);
  return [
    `tier=${parsed.tier}`,
    ...BUILT_TIERS.map((t) => `${t}=${/** @type {readonly string[]} */ (jobs).includes(t)}`),
    `not_built=${notBuilt.join(",")}`,
  ];
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    console.log(planOutputs(process.argv[2] ?? "").join("\n"));
  } catch (e) {
    console.error(/** @type {Error} */ (e).message);
    process.exit(1);
  }
}
