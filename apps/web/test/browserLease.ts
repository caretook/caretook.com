// Vitest's globalSetup for `web:components`: runs in Node once per run,
// before Chromium starts, and its teardown after Chromium closes.
//
// Component tests' Chromium counts against the same machine-wide `browser`
// lease as `pnpm prd browser` (four at once), so four worktrees can't each
// start browsers together. The lease comes from `scripts/loops/lease.mjs`
// (held by a `lease.sh hold` child that also releases if this process dies);
// `CARETOOK_LEASES=off` takes none.

type Release = () => Promise<void> | void;
type Lease = { n: number; path: string | null; release: Release };
type LeaseModule = { takeLease: (kind: string, opts: { label: string }) => Promise<Lease> };

const takeBrowserLease = async (): Promise<Release> => {
  const leaseUrl = new URL("../../../scripts/loops/lease.mjs", import.meta.url).href;
  const { takeLease } = (await import(/* @vite-ignore */ leaseUrl)) as LeaseModule;
  const lease = await takeLease("browser", { label: "web:components" });
  return () => lease.release();
};

let release: Release | undefined;

export async function setup() {
  release = await takeBrowserLease();
}

export async function teardown() {
  await release?.();
}
