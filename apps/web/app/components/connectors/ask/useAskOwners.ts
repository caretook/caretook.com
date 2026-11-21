import { ORPCError } from "@orpc/client";
import { useCallback, useEffect, useState } from "react";
import { ASK_FAILED, ASK_OFFLINE } from "~/lib/connectors/connectGuide";
import { rpc } from "~/lib/core/rpc";

/** What a failed ask says: offline, the server's refusal, or a generic retry. */
const failure = (e: unknown) => {
  if (e instanceof TypeError) return ASK_OFFLINE;
  if (e instanceof ORPCError && e.status < 500 && e.message) return e.message;
  return ASK_FAILED;
};

/**
 * The member's request to `groupId`'s owners (connectors-2, B-194): when
 * they last asked, and `ask`. Given `initial` (the server already loaded
 * it), it asks nothing until `ask`; otherwise it loads
 * `connector.myRequest` first (`askedAt` is undefined until then, and null
 * when they never asked or it couldn't load).
 */
export const useAskOwners = (groupId: string, initial?: string | null) => {
  const [askedAt, setAskedAt] = useState<string | null | undefined>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initial !== undefined) return;
    let live = true;
    rpc.connector.myRequest({ groupId }).then(
      (last) => live && setAskedAt(last?.requestedAt ?? null),
      () => live && setAskedAt(null),
    );
    return () => {
      live = false;
    };
  }, [groupId, initial]);

  const ask = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const request = await rpc.connector.requestEnable({ groupId });
      setAskedAt(request.requestedAt);
    } catch (e) {
      setError(failure(e));
    } finally {
      setBusy(false);
    }
  }, [groupId]);

  return { askedAt, busy, error, ask };
};
