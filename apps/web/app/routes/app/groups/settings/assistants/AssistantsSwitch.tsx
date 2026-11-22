import type { ActionResult } from "~/lib/core/api";

import { useState } from "react";
import { useFetcher } from "react-router";
import { ConfirmDialog, Message, ToggleField } from "~/components/ui";
import { turnOffMessage } from "./assistants";

/**
 * The owners' switch (online). Turning it on saves at once; turning it off
 * asks first, saying how many assistants it disconnects. The choice shows
 * while it saves and until the group's row syncs back; a refused change
 * shows what's saved, with the reason.
 */
export function AssistantsSwitch({ enabled, connected }: { enabled: boolean; connected: number }) {
  const fetcher = useFetcher<ActionResult>();
  const busy = fetcher.state !== "idle";
  const failed = !busy && fetcher.data?.ok === false ? fetcher.data.error : null;
  // What we last sent, until the synced value says the same.
  const [wanted, setWanted] = useState<boolean | null>(null);
  if (wanted !== null && wanted === enabled) setWanted(null);
  const shown = wanted !== null && !failed ? wanted : enabled;
  const [confirming, setConfirming] = useState(false);

  const send = (on: boolean) => {
    setWanted(on);
    void fetcher.submit({ intent: "setEnabled", enabled: on ? "on" : "off" }, { method: "post" });
  };

  return (
    <>
      <ToggleField
        label="Allow members to connect assistants"
        checked={shown}
        disabled={busy}
        data-assistants-switch=""
        onChange={(event) => (event.target.checked ? send(true) : setConfirming(true))}
      />
      <Message>
        {busy ? "Saving…" : fetcher.data?.ok ? (shown ? "Assistants are on." : "Assistants are off.") : ""}
      </Message>
      {failed && <Message tone="error">{failed}</Message>}
      <ConfirmDialog
        open={confirming}
        title="Turn off assistants?"
        message={turnOffMessage(connected)}
        confirmLabel="Turn off"
        onConfirm={() => {
          setConfirming(false);
          send(false);
        }}
        onClose={() => setConfirming(false)}
      />
    </>
  );
}
