import type { CalendarChange } from "~/lib/calendars/calendarSettings";

import { ORPCError } from "@orpc/client";
import { useEffect, useRef, useState } from "react";
import { useRevalidator } from "react-router";
import { saveCalendarSettings } from "~/lib/calendars/calendarSettings";

export type CalendarSaveStatus = { kind: "saving" | "saved" | "pending" } | { kind: "failed"; error: string };

/** What a refused or failed save says: the server's reason (written for people), else try again. */
const failure = (e: unknown) =>
  e instanceof ORPCError && e.message ? e.message : "Couldn't save that. Try again.";

/**
 * Save a change to the member's own calendar settings as soon as it's made
 * (`saveCalendarSettings`), for any card on the page, and how that went.
 * Only the latest save reports. A change kept on this device (offline) is
 * sent when the connection comes back: the page loads again, and its loader
 * sends what's pending.
 */
export function useCalendarSave(userId: string, groupId: string) {
  const [status, setStatus] = useState<CalendarSaveStatus | null>(null);
  const latest = useRef(0);
  const { revalidate } = useRevalidator();
  const reload = useRef(revalidate);
  useEffect(() => {
    reload.current = revalidate;
  }, [revalidate]);
  // The "back online" listener, from the moment a save is kept on the device.
  const waiting = useRef<(() => void) | null>(null);

  const stopWaiting = () => {
    if (waiting.current) window.removeEventListener("online", waiting.current);
    waiting.current = null;
  };
  useEffect(() => stopWaiting, []);

  const waitForConnection = () => {
    if (waiting.current) return;
    const retry = () => {
      stopWaiting();
      void reload.current().then(() => setStatus((s) => (s?.kind === "pending" ? null : s)));
    };
    waiting.current = retry;
    window.addEventListener("online", retry);
  };

  const save = (change: CalendarChange) => {
    const mine = ++latest.current;
    setStatus({ kind: "saving" });
    saveCalendarSettings(userId, groupId, change).then(
      (outcome) => {
        if (outcome === "pending") waitForConnection();
        if (mine === latest.current) setStatus({ kind: outcome });
      },
      (e: unknown) => mine === latest.current && setStatus({ kind: "failed", error: failure(e) }),
    );
  };

  return { status, save };
}
