import type { ApiOutputs } from "~/lib/core/rpc";

import { useCallback, useEffect, useState } from "react";
import { rpc } from "~/lib/core/rpc";

export type GoogleStatus = ApiOutputs["calendars"]["google"]["status"];

/**
 * The member's Google connection for the group (`calendars.google.status`),
 * loaded when the card shows online, and again on `reload` (after
 * Disconnect). `failed` when the status couldn't be read.
 */
export function useGoogleStatus(groupId: string, online: boolean) {
  const [status, setStatus] = useState<GoogleStatus | null>(null);
  const [failed, setFailed] = useState(false);
  const [asked, setAsked] = useState(0);

  useEffect(() => {
    if (!online) return;
    let live = true;
    rpc.calendars.google.status({ groupId }).then(
      (next) => {
        if (!live) return;
        setStatus(next);
        setFailed(false);
      },
      () => live && setFailed(true),
    );
    return () => {
      live = false;
    };
  }, [groupId, online, asked]);

  const reload = useCallback(() => setAsked((n) => n + 1), []);
  return { status, failed, reload };
}
