// Vitest's globalSetup for `web:components`: runs in Node once per run,
// before Chromium starts, and its teardown after Chromium closes.
//
// The hook for machine-wide leases: component tests' Chromium counts
// against the same `browser` lease as `pnpm prd browser` (four at once), so
// four worktrees can't each start browsers together. `takeBrowserLease` is
// the one place to wire it: the leases' Node entry (orchestration slice 4,
// `scripts/loops/`) takes a `browser` lease here and returns its release.
// Until then it takes nothing.

type Release = () => Promise<void> | void;

const takeBrowserLease = (): Promise<Release> => {
  // Wire the lease library here: `return take("browser", { label: "web:components" })`.
  return Promise.resolve(() => undefined);
};

let release: Release | undefined;

export async function setup() {
  release = await takeBrowserLease();
}

export async function teardown() {
  await release?.();
}
