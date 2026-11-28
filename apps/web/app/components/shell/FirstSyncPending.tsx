import { useEffect } from "react";
import { useRevalidator } from "react-router";
import { PageLoading } from "~/components/ui";
import { useFirstSyncDone } from "~/lib/sync";
import { startupDisplay, useStartup } from "~/lib/sync/startup";

/**
 * A new device's first sync is taking a while: say so instead of showing an
 * empty (or "not found") screen, and rerun the loaders once it's done.
 * The frame's full-page loader (`PageLoading`, B-908) at the startup's sync
 * step (`lib/sync/startup`, B-957): "Syncing your care groups… 40%" and the
 * bar, moving with the download.
 */
export function FirstSyncPending() {
  const done = useFirstSyncDone();
  const { revalidate } = useRevalidator();
  const display = startupDisplay(useStartup("sync"));
  useEffect(() => {
    if (done) void revalidate();
  }, [done, revalidate]);
  return <PageLoading {...display} data-first-sync-pending="" />;
}
