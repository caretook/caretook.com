import type { CalendarSaveStatus } from "./useCalendarSave";

import { Message } from "~/components/ui";

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
    </div>
  );
}
