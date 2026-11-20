import type { ActionResult } from "~/lib/core/api";

import { ORPCError } from "@orpc/client";
import { Clock, CircleX } from "lucide-react";
import { useState, useSyncExternalStore } from "react";
import { useFetcher } from "react-router";
import { ConfirmDialog } from "~/components/ui";
import { toActionResult } from "~/lib/core/api";
import { rpc } from "~/lib/core/rpc";

// `/app` home's "Waiting for approval: <group>" (invites slice 4): the
// requests to join this person made through invite links, from the API
// (requests don't sync, and nothing of the group is on the device until
// they're approved). Once approved, the membership syncs and the group
// appears in the home's live list, so its request is hidden here at once,
// without a reload. Requests declined lately say so. A waiting request can
// be withdrawn (online only, after a confirm); the home's loader then runs
// again and the row goes.

export type MyJoinRequest = {
  id: string;
  groupId: string;
  status: "pending" | "declined";
  groupName: string;
};

export const WITHDRAW_INTENT = "withdrawRequest";
const WITHDRAW_OFFLINE = "Needs a connection to withdraw.";

/** The signed-in user's waiting and recently declined requests; none offline. */
export const loadMyRequests = async (): Promise<MyJoinRequest[]> => {
  try {
    return await rpc.joinRequest.mine();
  } catch {
    // Offline, or the session went: the home still loads from the device.
    return [];
  }
};

/**
 * The home's action: withdraw one of your own waiting requests. A request
 * that's no longer waiting (withdrawn elsewhere, or answered) is gone from
 * the list once the loader runs again, so that's not an error here.
 */
export const withdrawRequest = async (requestId: string): Promise<ActionResult> => {
  try {
    await rpc.joinRequest.withdraw({ id: requestId });
    return { ok: true };
  } catch (e) {
    // fetch fails with a TypeError when there's no connection.
    if (e instanceof TypeError) return { ok: false, error: WITHDRAW_OFFLINE, issues: [] };
    if (e instanceof ORPCError && e.code === "NOT_FOUND") return { ok: true };
    return toActionResult(e);
  }
};

const subscribeOnline = (onChange: () => void) => {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
};

/** The browser's own idea of a connection (a failed call still says so too). */
const useOnline = () =>
  useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true,
  );

export function PendingRequests({ requests, groupIds }: { requests: MyJoinRequest[]; groupIds: string[] }) {
  const [withdrawing, setWithdrawing] = useState<MyJoinRequest | null>(null);
  const fetcher = useFetcher<ActionResult>();
  const online = useOnline();
  const shown = requests.filter((r) => !groupIds.includes(r.groupId));
  const result = fetcher.state === "idle" ? fetcher.data : undefined;
  if (!shown.length) return null;

  const confirmWithdraw = () => {
    if (!withdrawing) return;
    void fetcher.submit({ intent: WITHDRAW_INTENT, requestId: withdrawing.id }, { method: "post" });
    setWithdrawing(null);
  };
  const busyId = fetcher.state !== "idle" ? fetcher.formData?.get("requestId") : null;

  return (
    <section aria-label="Requests to join" data-my-requests="" className="space-y-2">
      <ul className="space-y-2">
        {shown.map((request) => (
          <li
            key={request.id}
            data-my-request={request.groupId}
            data-request-status={request.status}
            className="card bg-base-100 shadow-sm"
          >
            <div className="card-body flex-row items-start gap-3 p-4">
              {request.status === "pending" ? (
                <Clock aria-hidden="true" className="text-base-content/60 mt-0.5 size-5 shrink-0" />
              ) : (
                <CircleX aria-hidden="true" className="text-base-content/60 mt-0.5 size-5 shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                <p className="font-semibold">
                  {request.status === "pending" ? "Waiting for approval" : "Not approved"}:{" "}
                  {request.groupName}
                </p>
                <p className="text-base-content/70 text-sm">
                  {request.status === "pending"
                    ? "An owner or admin of the group will answer your request. It opens here once they approve."
                    : "Your request to join wasn't approved. Ask the person who shared the link if you think that's a mistake."}
                </p>
                {request.status === "pending" && (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      className="btn btn-sm"
                      data-withdraw-request={request.id}
                      disabled={!online || busyId === request.id}
                      aria-describedby={online ? undefined : `withdraw-offline-${request.id}`}
                      aria-label={`Withdraw your request to join ${request.groupName}`}
                      onClick={() => setWithdrawing(request)}
                    >
                      {busyId === request.id ? "Withdrawing…" : "Withdraw"}
                    </button>
                    {!online && (
                      <span id={`withdraw-offline-${request.id}`} className="text-base-content/70 text-sm">
                        Needs a connection
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
      {result && !result.ok && (
        <p role="alert" data-withdraw-error="" className="text-error text-sm">
          {result.error}
        </p>
      )}
      <ConfirmDialog
        open={!!withdrawing}
        title={`Withdraw your request to join ${withdrawing?.groupName ?? "this group"}?`}
        message="The group's owners and admins won't see it any more."
        confirmLabel="Withdraw"
        onConfirm={confirmWithdraw}
        onClose={() => setWithdrawing(null)}
      />
    </section>
  );
}
