import type { ConnectorScope } from "@caretook/data/schema";
import type { DevicesActionResult, MyConnection } from "./route";

import { CONNECTOR_SCOPE_LABELS } from "@caretook/data/schema";
import { Bot } from "lucide-react";
import { useState } from "react";
import { useFetcher } from "react-router";
import { SettingsCard } from "~/components/settings";
import { Button, ConfirmDialog, EmptyState, Message } from "~/components/ui";
import { formatAgo } from "~/lib/core/format";

const scopeLabel = (scope: string) => CONNECTOR_SCOPE_LABELS[scope as ConnectorScope] ?? scope;
const groupOf = (c: MyConnection) => c.groupName ?? "a care group";

/**
 * Settings → Devices' "Connected assistants": the AI assistants the member
 * connected (Claude, ChatGPT…), each to one care group, with Disconnect
 * behind a confirm. Online only, like the sessions above it.
 */
export function ConnectedAssistants({ connections }: { connections: MyConnection[] }) {
  const fetcher = useFetcher<DevicesActionResult>();
  const [pending, setPending] = useState<MyConnection | null>(null);
  // What the last disconnect was, said once it has gone through.
  const [asked, setAsked] = useState<string | null>(null);
  const busy = fetcher.state !== "idle";

  const confirm = () => {
    if (!pending) return;
    setAsked(`Disconnected ${pending.clientName} from ${groupOf(pending)}.`);
    void fetcher.submit({ intent: "disconnect", id: pending.id }, { method: "post" });
    setPending(null);
  };

  return (
    <SettingsCard id="connected-assistants" title="Connected assistants">
      {connections.length === 0 ? (
        <EmptyState>You haven&apos;t connected an AI assistant to a care group.</EmptyState>
      ) : (
        <ul data-connections="" className="divide-base-300 divide-y">
          {connections.map((c) => (
            <li key={c.id} data-connection={c.id} className="flex items-center gap-3 py-3">
              <Bot aria-hidden="true" className="text-base-content/70 size-5 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  {c.clientName} · {groupOf(c)}
                </p>
                <p className="text-base-content/70 text-sm">
                  {scopeLabel(c.scope)} · Connected {formatAgo(c.consentedAt)} ·{" "}
                  {c.lastUsedAt ? `Last used ${formatAgo(c.lastUsedAt)}` : "Not used yet"}
                </p>
              </div>
              <Button
                size="sm"
                disabled={busy}
                aria-label={`Disconnect ${c.clientName} from ${groupOf(c)}`}
                onClick={() => setPending(c)}
              >
                Disconnect
              </Button>
            </li>
          ))}
        </ul>
      )}
      <Message>{busy ? "Disconnecting…" : fetcher.data?.ok ? (asked ?? "") : ""}</Message>
      {!busy && fetcher.data && !fetcher.data.ok && <Message tone="error">{fetcher.data.error}</Message>}
      <ConfirmDialog
        open={!!pending}
        title={pending ? `Disconnect ${pending.clientName}?` : "Disconnect?"}
        message={
          pending ? `It stops reaching ${groupOf(pending)} at once. You can connect it again later.` : null
        }
        confirmLabel="Disconnect"
        onConfirm={confirm}
        onClose={() => setPending(null)}
      />
    </SettingsCard>
  );
}
