import type { GoogleCalendarStatus } from "@caretook/data/schema";

// The Google Calendar card's pure parts (calendars, appointments-2 slice 7):
// whether the card is there, what it shows, and its wording. The server
// decides; Connect leaves for Google through the web-only
// `/api/google/connect`, so the native app has no card.

/** Google connects through web-only routes: no card on the native target. */
export const showsGoogleCard = (target: string | undefined) => target !== "native";

/** Where Connect (and Reconnect) goes: a plain link, a full page load (it ends at Google). */
export const googleConnectHref = (groupId: string) =>
  `/api/google/connect?groupId=${encodeURIComponent(groupId)}`;

export const GOOGLE_EXPLAINED =
  "Caretook makes a calendar of its own in your Google account and keeps it current. Your other calendars are never read or changed.";
export const GOOGLE_OFFLINE = "Needs a connection to show Google Calendar.";
export const GOOGLE_UNAVAILABLE = "Google Calendar isn't set up here yet.";
export const GOOGLE_LOAD_FAILED = "Couldn't load Google Calendar. Try again later.";
export const DISCONNECT_MESSAGE = "The calendar stays in Google but stops updating.";

/** What the callback came back with (`?google=`), said once on the page. */
export const GOOGLE_OUTCOME_TEXT: Record<string, { tone: "success" | "error"; text: string }> = {
  connected: {
    tone: "success",
    text: "Google Calendar is connected. Your calendar fills in over the next minute.",
  },
  expired: { tone: "error", text: "That Google sign-in expired. Try Connect again." },
  denied: { tone: "error", text: "Google Calendar wasn't connected: access wasn't given." },
  unavailable: { tone: "error", text: GOOGLE_UNAVAILABLE },
  failed: { tone: "error", text: "Couldn't connect Google Calendar. Try again." },
};

/** Why syncing stopped, and what to do. */
export const GOOGLE_ERROR_TEXT: Record<string, string> = {
  revoked: "Google stopped Caretook's access. Reconnect Google to keep your calendar current.",
  calendarGone: "The Caretook calendar is gone from your Google account. Disconnect, then connect again.",
};

export type GoogleCardView =
  | { kind: "offline" }
  | { kind: "loading" }
  | { kind: "failed" }
  | { kind: "unavailable" }
  | { kind: "connect" }
  | {
      kind: "connected";
      calendarName: string;
      lastSynced: string | null;
      error: string | null;
      /** A refused token: Connect again, which keeps the calendar. */
      reconnect: boolean;
    };

/** "19 Nov, 9:05" in the viewer's zone. */
export const syncedText = (iso: string, timeZone?: string) =>
  new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  });

/** What the card shows, from the connection and how its status load went. */
export const googleCardView = ({
  online,
  status,
  failed,
  timeZone,
}: {
  online: boolean;
  status: GoogleCalendarStatus | null;
  failed: boolean;
  timeZone?: string;
}): GoogleCardView => {
  if (!online) return { kind: "offline" };
  if (failed) return { kind: "failed" };
  if (!status) return { kind: "loading" };
  if (!status.connected) return status.configured ? { kind: "connect" } : { kind: "unavailable" };
  return {
    kind: "connected",
    calendarName: status.calendarName,
    lastSynced: status.lastPushedAt ? syncedText(status.lastPushedAt, timeZone) : null,
    error: status.error ? (GOOGLE_ERROR_TEXT[status.error] ?? GOOGLE_LOAD_FAILED) : null,
    reconnect: status.error === "revoked" && status.configured,
  };
};
