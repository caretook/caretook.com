import type { ActionResult } from "~/lib/core/api";

import { useState } from "react";
import { useFetcher } from "react-router";
import { SettingsCard } from "~/components/settings";
import { Message, ToggleField } from "~/components/ui";

export const DETAILS_OUTSIDE_EXPLAINED =
  "Members can choose to include titles, places and providers in their own reminder emails, calendar feeds and Google Calendar. Turn this off to keep what leaves Caretook generic for everyone.";

/**
 * The owners' "Details outside Caretook" switch (calendars, appointments-2):
 * online, through `calendars.group.setDetailsAllowed`. `allowed` is the
 * device's copy (live); the choice shows while it saves and until the
 * group's row syncs back, and a refused change shows what's saved with the
 * reason. Offline it's a status line.
 */
export function DetailsOutsideCard({ allowed, editable }: { allowed: boolean; editable: boolean }) {
  const fetcher = useFetcher<ActionResult>();
  const busy = fetcher.state !== "idle";
  const failed = !busy && fetcher.data?.ok === false ? fetcher.data.error : null;
  // What we last sent, until the synced value says the same.
  const [wanted, setWanted] = useState<boolean | null>(null);
  if (wanted !== null && wanted === allowed) setWanted(null);
  const shown = wanted !== null && !failed ? wanted : allowed;

  const send = (on: boolean) => {
    setWanted(on);
    void fetcher.submit({ intent: "detailsOutside", allowed: on ? "on" : "off" }, { method: "post" });
  };

  return (
    <SettingsCard id="details-outside-allowed" title="Details outside Caretook">
      <p className="text-muted text-sm">{DETAILS_OUTSIDE_EXPLAINED}</p>
      {editable ? (
        <ToggleField
          label="Let members include details"
          checked={shown}
          disabled={busy}
          data-details-allowed=""
          onChange={(event) => send(event.target.checked)}
        />
      ) : (
        <p className="text-sm" data-details-allowed-status="">
          {allowed ? "Members may include details." : "Details stay private for everyone."}
        </p>
      )}
      <Message>{busy ? "Saving…" : fetcher.data?.ok ? "Saved." : ""}</Message>
      {failed && <Message tone="error">{failed}</Message>}
    </SettingsCard>
  );
}
