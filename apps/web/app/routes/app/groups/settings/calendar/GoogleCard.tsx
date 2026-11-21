import type { ActionResult } from "~/lib/core/api";
import type { CalendarCardProps } from "./calendarPage";

import { useEffect, useRef, useState } from "react";
import { useFetcher, useSearchParams } from "react-router";
import { SettingsCard } from "~/components/settings";
import { ConfirmDialog } from "~/components/ui";
import {
  DISCONNECT_MESSAGE,
  GOOGLE_EXPLAINED,
  GOOGLE_LOAD_FAILED,
  GOOGLE_OFFLINE,
  GOOGLE_OUTCOME_TEXT,
  GOOGLE_UNAVAILABLE,
  googleCardView,
  googleConnectHref,
} from "./googleCardView";
import { useGoogleStatus } from "./useGoogleStatus";

/**
 * Google Calendar (web only; slice 7): Connect, which goes to Google's
 * consent page and back (`?google=` says how it went), or the calendar's
 * name, when it last synced, any error (Reconnect after a refused token),
 * and Disconnect, after a confirm. Online only: the status comes from
 * `calendars.google.status`.
 */
export function GoogleCard({ groupId, online }: CalendarCardProps) {
  const { status, failed, reload } = useGoogleStatus(groupId, online);
  const view = googleCardView({ online, status, failed });
  const [params] = useSearchParams();
  const outcome = GOOGLE_OUTCOME_TEXT[params.get("google") ?? ""];
  const [confirming, setConfirming] = useState(false);
  const fetcher = useFetcher<ActionResult>();
  const disconnecting = fetcher.state !== "idle";
  const result = disconnecting ? undefined : fetcher.data;

  // Once Disconnect has gone through, show the card's new state.
  const reloaded = useRef<ActionResult | undefined>(undefined);
  useEffect(() => {
    if (result?.ok && reloaded.current !== result) {
      reloaded.current = result;
      reload();
    }
  }, [result, reload]);

  const disconnect = () => {
    setConfirming(false);
    void fetcher.submit({ intent: "googleDisconnect" }, { method: "post" });
  };

  return (
    <>
      <SettingsCard id="google-calendar" title="Google Calendar">
        <p className="text-base-content/70 text-sm">{GOOGLE_EXPLAINED}</p>
        {outcome && (
          <p
            role={outcome.tone === "error" ? "alert" : "status"}
            className={`text-sm ${outcome.tone === "error" ? "text-error" : "text-success"}`}
            data-google-outcome=""
          >
            {outcome.text}
          </p>
        )}
        {view.kind === "offline" && <p className="text-sm">{GOOGLE_OFFLINE}</p>}
        {view.kind === "loading" && <p className="text-sm">Loading…</p>}
        {view.kind === "failed" && <p className="text-sm">{GOOGLE_LOAD_FAILED}</p>}
        {view.kind === "unavailable" && <p className="text-sm">{GOOGLE_UNAVAILABLE}</p>}
        {view.kind === "connect" && (
          <div>
            <a className="btn btn-primary btn-sm" href={googleConnectHref(groupId)} data-google-connect="">
              Connect Google Calendar
            </a>
          </div>
        )}
        {view.kind === "connected" && (
          <div className="space-y-2" data-google-connected="">
            <p className="text-sm">
              Syncing to <span className="font-medium">{view.calendarName}</span> in your Google account.
            </p>
            <p className="text-base-content/70 text-sm" data-google-synced="">
              {view.lastSynced ? `Last synced ${view.lastSynced}.` : "Not synced yet."}
            </p>
            {view.error && (
              <p role="alert" className="text-error text-sm" data-google-error="">
                {view.error}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              {view.reconnect && (
                <a className="btn btn-primary btn-sm" href={googleConnectHref(groupId)}>
                  Reconnect Google
                </a>
              )}
              <button
                type="button"
                className="btn btn-sm"
                data-google-disconnect=""
                disabled={disconnecting}
                onClick={() => setConfirming(true)}
              >
                {disconnecting ? "Disconnecting…" : "Disconnect"}
              </button>
            </div>
          </div>
        )}
        {result && !result.ok && (
          <p role="alert" className="text-error text-sm">
            {result.error}
          </p>
        )}
      </SettingsCard>
      {/* Outside the card, so it isn't one of the card's parts. */}
      <ConfirmDialog
        open={confirming}
        title="Disconnect Google Calendar?"
        message={DISCONNECT_MESSAGE}
        confirmLabel="Disconnect"
        onConfirm={disconnect}
        onClose={() => setConfirming(false)}
      />
    </>
  );
}
