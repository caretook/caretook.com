import { useEffect } from "react";
import { useRevalidator } from "react-router";
import { useFirstSyncDone } from "~/lib/sync";

/**
 * A new device's first sync is taking a while: say so instead of showing an
 * empty (or "not found") screen, and rerun the loaders once it's done.
 */
export function FirstSyncPending() {
  const done = useFirstSyncDone();
  const { revalidate } = useRevalidator();
  useEffect(() => {
    if (done) void revalidate();
  }, [done, revalidate]);
  return (
    <main className="mx-auto max-w-2xl px-4 py-10" data-first-sync-pending="">
      <p role="status" className="text-base-content/70 flex items-center gap-3">
        <span className="loading loading-spinner loading-sm" aria-hidden="true" />
        Getting your care groups…
      </p>
    </main>
  );
}
