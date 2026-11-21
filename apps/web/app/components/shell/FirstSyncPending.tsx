import { useEffect } from "react";
import { useRevalidator } from "react-router";
import { Loading } from "~/components/ui";
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
      <Loading label="Getting your care groups…" />
    </main>
  );
}
