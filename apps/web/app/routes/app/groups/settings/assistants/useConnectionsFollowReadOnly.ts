import { useEffect } from "react";
import { useRevalidator } from "react-router";

/**
 * Loads the connections again when the synced read-only setting differs from
 * the one the page last loaded with. Their labels stay the server's: only it
 * knows each member's current role, which decides whether the owner's setting
 * is why a connection can only read.
 */
export function useConnectionsFollowReadOnly(readOnly: boolean, loadedReadOnly: boolean, listed: boolean) {
  const { revalidate } = useRevalidator();
  useEffect(() => {
    if (listed && readOnly !== loadedReadOnly) void revalidate();
  }, [listed, readOnly, loadedReadOnly, revalidate]);
}
