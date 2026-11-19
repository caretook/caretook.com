import { Clock, CircleX } from "lucide-react";
import { rpc } from "~/lib/rpc";

// `/app` home's "Waiting for approval: <group>" (invites slice 4): the
// requests to join this person made through invite links, from the API
// (requests don't sync, and nothing of the group is on the device until
// they're approved). Once approved, the membership syncs and the group
// appears in the home's live list, so its request is hidden here at once,
// without a reload. Requests declined lately say so.

export type MyJoinRequest = {
  id: string;
  groupId: string;
  status: "pending" | "declined";
  groupName: string;
};

/** The signed-in user's waiting and recently declined requests; none offline. */
export const loadMyRequests = async (): Promise<MyJoinRequest[]> => {
  try {
    return await rpc.joinRequest.mine();
  } catch {
    // Offline, or the session went: the home still loads from the device.
    return [];
  }
};

export function PendingRequests({ requests, groupIds }: { requests: MyJoinRequest[]; groupIds: string[] }) {
  const shown = requests.filter((r) => !groupIds.includes(r.groupId));
  if (!shown.length) return null;
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
              <div className="min-w-0">
                <p className="font-semibold">
                  {request.status === "pending" ? "Waiting for approval" : "Not approved"}:{" "}
                  {request.groupName}
                </p>
                <p className="text-base-content/70 text-sm">
                  {request.status === "pending"
                    ? "An owner or admin of the group will answer your request. It opens here once they approve."
                    : "Your request to join wasn't approved. Ask the person who shared the link if you think that's a mistake."}
                </p>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
