import type { CalendarSaveStatus } from "./useCalendarSave";

/** How a card's last save went (`useCalendarSave`). */
export function CalendarSaveLine({ status }: { status: CalendarSaveStatus | null }) {
  return (
    <div className="min-h-5">
      {status?.kind === "saving" && (
        <p role="status" className="text-sm">
          Saving…
        </p>
      )}
      {(status?.kind === "saved" || status?.kind === "pending") && (
        <p role="status" className="text-success text-sm">
          {status.kind === "saved" ? "Saved." : "Saved on this device. It's sent when you're back online."}
        </p>
      )}
      {status?.kind === "failed" && (
        <p role="alert" className="text-error text-sm">
          {status.error}
        </p>
      )}
    </div>
  );
}
