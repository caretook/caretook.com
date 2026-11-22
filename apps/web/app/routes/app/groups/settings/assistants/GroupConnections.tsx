import type { ActionResult } from "~/lib/core/api";
import type { GroupConnection } from "./route";

import { Bot } from "lucide-react";
import { useState } from "react";
import { useFetcher } from "react-router";
import { SettingsCard } from "~/components/settings";
import { Button, ConfirmDialog, EmptyState, List, ListRow, Message } from "~/components/ui";
import { formatAgo } from "~/lib/core/format";
import { memberName } from "../groupSettings";
import { scopeLabel } from "./assistants";

/** Every member's connected assistants (owners and admins, online), each with Disconnect behind a confirm. */
export function GroupConnections({ connections }: { connections: GroupConnection[] }) {
  const fetcher = useFetcher<ActionResult>();
  const [pending, setPending] = useState<GroupConnection | null>(null);
  // What the last disconnect was, said once it has gone through.
  const [asked, setAsked] = useState<string | null>(null);
  const busy = fetcher.state !== "idle";
  const who = (c: GroupConnection) => memberName(c.memberName);

  const confirm = () => {
    if (!pending) return;
    setAsked(`Disconnected ${who(pending)}'s ${pending.clientName}.`);
    void fetcher.submit({ intent: "disconnect", id: pending.id }, { method: "post" });
    setPending(null);
  };

  return (
    <SettingsCard id="group-connections" title="Connected assistants">
      {connections.length === 0 ? (
        <EmptyState>No one has connected an assistant to this care group.</EmptyState>
      ) : (
        <List data-connections="">
          {connections.map((c) => (
            <ListRow
              key={c.id}
              data-connection={c.id}
              trailing={
                <Button
                  size="sm"
                  disabled={busy}
                  aria-label={`Disconnect ${who(c)}'s ${c.clientName}`}
                  onClick={() => setPending(c)}
                >
                  Disconnect
                </Button>
              }
            >
              <div className="flex items-center gap-3">
                <Bot aria-hidden="true" className="text-muted size-5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    {who(c)} · {c.clientName}
                  </p>
                  <p className="text-muted text-sm">
                    {scopeLabel(c.scope)} · Connected {formatAgo(c.consentedAt)} ·{" "}
                    {c.lastUsedAt ? `Last used ${formatAgo(c.lastUsedAt)}` : "Not used yet"}
                  </p>
                </div>
              </div>
            </ListRow>
          ))}
        </List>
      )}
      <Message>{busy ? "Disconnecting…" : fetcher.data?.ok ? (asked ?? "") : ""}</Message>
      {!busy && fetcher.data && !fetcher.data.ok && <Message tone="error">{fetcher.data.error}</Message>}
      <ConfirmDialog
        open={!!pending}
        title={pending ? `Disconnect ${who(pending)}'s ${pending.clientName}?` : "Disconnect?"}
        message="It stops reaching this care group at once. They can connect it again while assistants are on."
        confirmLabel="Disconnect"
        onConfirm={confirm}
        onClose={() => setPending(null)}
      />
    </SettingsCard>
  );
}
