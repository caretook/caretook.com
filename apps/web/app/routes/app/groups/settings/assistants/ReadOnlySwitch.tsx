import type { ActionResult } from "~/lib/core/api";

import { useState } from "react";
import { useFetcher } from "react-router";
import { Message, ToggleField } from "~/components/ui";
import { READ_ONLY_HELP } from "./assistants";

/**
 * The owners' read-only choice (online, while assistants are on). Either way
 * saves at once: it disconnects no one. The choice shows until the group's
 * row syncs back; a refused change shows what's saved, with the reason.
 */
export function ReadOnlySwitch({ readOnly }: { readOnly: boolean }) {
  const fetcher = useFetcher<ActionResult>();
  const busy = fetcher.state !== "idle";
  const failed = !busy && fetcher.data?.ok === false ? fetcher.data.error : null;
  // What we last sent, until the synced value says the same.
  const [wanted, setWanted] = useState<boolean | null>(null);
  if (wanted !== null && wanted === readOnly) setWanted(null);
  const shown = wanted !== null && !failed ? wanted : readOnly;

  const send = (on: boolean) => {
    setWanted(on);
    void fetcher.submit({ intent: "setReadOnly", readOnly: on ? "on" : "off" }, { method: "post" });
  };

  return (
    <>
      <ToggleField
        label="Read only"
        help={READ_ONLY_HELP}
        checked={shown}
        disabled={busy}
        data-assistants-read-only-switch=""
        onChange={(event) => send(event.target.checked)}
      />
      <Message>
        {busy
          ? "Saving…"
          : fetcher.data?.ok
            ? shown
              ? "Assistants can only read."
              : "Assistants can read and add entries."
            : ""}
      </Message>
      {failed && <Message tone="error">{failed}</Message>}
    </>
  );
}
