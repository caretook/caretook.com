import type { CalendarSaveStatus } from "./useCalendarSave";

import { useState } from "react";
import { Button, Message } from "~/components/ui";
import { reloadToLatest } from "~/lib/app-shell/serviceWorkerRegister";

/** Loads the current version of the app, for a refusal only that can fix. */
function ReloadButton() {
  const [reloading, setReloading] = useState(false);
  const reload = () => {
    setReloading(true);
    // Absent on the native app and on insecure origins, whatever the DOM types say.
    const container = (navigator as Partial<Navigator>).serviceWorker;
    void reloadToLatest(container, () => window.location.reload());
  };
  return (
    <Button size="sm" className="mt-2" busy={reloading} busyLabel="Reloading…" onClick={reload}>
      Reload
    </Button>
  );
}

/** How a card's last save went (`useCalendarSave`). */
export function CalendarSaveLine({ status }: { status: CalendarSaveStatus | null }) {
  return (
    <div className="min-h-5">
      <Message>{status?.kind === "saving" && "Saving…"}</Message>
      <Message tone="success">
        {status?.kind === "saved"
          ? "Saved."
          : status?.kind === "pending"
            ? "Saved on this device. It's sent when you're back online."
            : null}
      </Message>
      {status?.kind === "failed" && <Message tone="error">{status.error}</Message>}
      {status?.kind === "failed" && status.reload && <ReloadButton />}
    </div>
  );
}
