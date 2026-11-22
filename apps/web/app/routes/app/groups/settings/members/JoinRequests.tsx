import type { LinkActionResult } from "./linkApi";
import type { JoinRequestRow } from "./linkRules";

import { UserRoundPlus } from "lucide-react";
import { useState } from "react";
import { useFetcher } from "react-router";
import { Button, Card, ConfirmDialog, EmptyState, List, ListRow, Message } from "~/components/ui";
import { roleLabel } from "../groupSettings";
import { requestedLine, requesterName } from "./linkRules";

// The Members page's Requests list (owners and admins, online): people who
// asked to join through an invite link, with the name and address they gave
// and the link's role. Approve makes them a member; Decline (after a
// confirm) leaves them out. Either way they're emailed.

export function JoinRequests({ requests }: { requests: JoinRequestRow[] }) {
  const [declining, setDeclining] = useState<JoinRequestRow | null>(null);
  const declineFetcher = useFetcher<LinkActionResult>();
  const confirmDecline = () => {
    if (!declining) return;
    void declineFetcher.submit({ intent: "declineRequest", requestId: declining.id }, { method: "post" });
    setDeclining(null);
  };
  const declineResult = declineFetcher.state === "idle" ? declineFetcher.data : undefined;
  if (!requests.length && !declineResult) return null;

  return (
    <Card title="Requests to join" data-join-requests="">
      {requests.length ? (
        <List>
          {requests.map((request) => (
            <JoinRequest
              key={request.id}
              request={request}
              declining={
                declineFetcher.state !== "idle" && declineFetcher.formData?.get("requestId") === request.id
              }
              onDecline={() => setDeclining(request)}
            />
          ))}
        </List>
      ) : (
        <EmptyState>No one is waiting.</EmptyState>
      )}
      {declineResult && !declineResult.ok && <Message tone="error">{declineResult.error}</Message>}
      <ConfirmDialog
        open={!!declining}
        title={`Decline ${declining ? requesterName(declining) : "this person"}'s request? They'll be told by email.`}
        confirmLabel="Decline"
        onConfirm={confirmDecline}
        onClose={() => setDeclining(null)}
      />
    </Card>
  );
}

function JoinRequest({
  request,
  declining,
  onDecline,
}: {
  request: JoinRequestRow;
  declining: boolean;
  onDecline: () => void;
}) {
  const fetcher = useFetcher<LinkActionResult>();
  const approving = fetcher.state !== "idle";
  const result = approving ? undefined : fetcher.data;
  const name = requesterName(request);
  return (
    <ListRow data-join-request={request.id} className="space-y-1">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <UserRoundPlus aria-hidden="true" className="text-base-content/60 size-5 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{request.name?.trim() || request.email}</p>
          <p className="text-base-content/70 truncate text-sm">
            {request.name?.trim() && request.email ? `${request.email} · ` : ""}
            {roleLabel(request.role)} · {requestedLine(request)}
          </p>
        </div>
        <Button
          variant="primary"
          size="sm"
          busy={approving}
          busyLabel="Approving…"
          disabled={declining}
          aria-label={`Approve ${name}`}
          onClick={() =>
            void fetcher.submit({ intent: "approveRequest", requestId: request.id }, { method: "post" })
          }
        >
          Approve
        </Button>
        <Button
          variant="ghost"
          size="sm"
          busy={declining}
          busyLabel="Declining…"
          disabled={approving}
          aria-label={`Decline ${name}`}
          onClick={onDecline}
        >
          Decline
        </Button>
      </div>
      {result && !result.ok && <Message tone="error">{result.error}</Message>}
    </ListRow>
  );
}
