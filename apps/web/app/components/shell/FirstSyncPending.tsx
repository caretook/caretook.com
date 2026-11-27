import { useEffect } from "react";
import { useRevalidator } from "react-router";
import { PageLoading } from "~/components/ui";
import { useFirstSyncDone } from "~/lib/sync";

/**
 * A new device's first sync is taking a while: say so instead of showing an
 * empty (or "not found") screen, and rerun the loaders once it's done.
 * The frame's full-page loader (`PageLoading`, B-908).
 */
export function FirstSyncPending() {
  const done = useFirstSyncDone();
  const { revalidate } = useRevalidator();
  useEffect(() => {
    if (done) void revalidate();
  }, [done, revalidate]);
  return <PageLoading message="Getting your care groups…" data-first-sync-pending="" />;
}
