import type { CalendarCardProps } from "./calendarPage";
import type { ShareOutcome } from "../members/linkRules";
import type { FeedActionResult } from "./feedActions";

import { Copy, Link2Off, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { useFetcher } from "react-router";
import { SettingsCard } from "~/components/settings";
import { ConfirmDialog } from "~/components/ui";
import { feedLinks } from "~/lib/calendars/feedLinks";
import { copyLinkText } from "../members/linkRules";

export const FEED_EXPLAINED =
  "A private link that shows this group's appointments, reminders and tasks with a due day in your own calendar app (Apple, Google, Outlook), from 90 days back to 90 days ahead.";

export const FEED_SECRET =
  "Anyone with the link can see the calendar, so keep it private. It's shown only now: if you lose it, regenerate one.";

export const FEED_SAYS = {
  generic: 'It says only "Appointment for …", the time and a link back to Caretook.',
  details: "It includes titles, places and providers, as you chose under Details outside Caretook.",
} as const;

export const REGENERATE_WARNING =
  "The old link stops working: calendars using it stop updating until you add the new one.";

const madeOn = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

/**
 * The member's calendar feed (calendars, appointments-2): make it, copy its
 * link or add it to Apple, Google or Outlook, regenerate (the old link stops
 * working, after a confirm) or revoke. Every member, viewers included. The
 * server keeps only the link's hash, so the link is shown once, when it's
 * made; later the card says the feed is on and offers Regenerate. Online
 * only (the posts are oRPC).
 */
export function FeedCard({ settings, online }: CalendarCardProps) {
  const fetcher = useFetcher<FeedActionResult>();
  const busy = fetcher.state !== "idle";
  const result = fetcher.data;
  const failed = !busy && result?.ok === false ? result.error : null;
  const url = !busy && result?.ok ? ((result as { feedUrl?: string }).feedUrl ?? null) : null;
  const [confirming, setConfirming] = useState(false);
  const [copied, setCopied] = useState<ShareOutcome | null>(null);
  useEffect(() => {
    if (copied !== "copied") return;
    const t = setTimeout(() => setCopied(null), 2500);
    return () => clearTimeout(t);
  }, [copied]);

  const send = (intent: "feedCreate" | "feedRotate" | "feedRevoke") => {
    setCopied(null);
    void fetcher.submit({ intent }, { method: "post" });
  };

  const active = settings?.feed.active ?? false;
  const links = url ? feedLinks(url, "Caretook") : null;

  return (
    <>
      <SettingsCard id="calendar-feed" title="Calendar feed">
        <p className="text-base-content/70 text-sm">{FEED_EXPLAINED}</p>
        {!settings ? (
          <p className="text-sm" data-feed-unknown="">
            Needs a connection to show your feed.
          </p>
        ) : (
          <>
            <p className="text-base-content/70 text-sm" data-feed-says="">
              {FEED_SAYS[settings.shareLevel]}
            </p>
            {!active && (
              <div>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={!online || busy}
                  data-feed-create=""
                  onClick={() => send("feedCreate")}
                >
                  {busy ? "Creating…" : "Create calendar feed"}
                </button>
              </div>
            )}
            {active && (
              <>
                {url && links ? (
                  <div className="space-y-3" data-feed-link="">
                    <label className="block text-sm font-medium">
                      Your feed link
                      <input
                        readOnly
                        value={url}
                        onFocus={(e) => e.currentTarget.select()}
                        className="input mt-1 w-full font-normal"
                      />
                    </label>
                    <p className="text-sm" data-feed-secret="">
                      {FEED_SECRET}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="btn btn-sm"
                        onClick={() => void copyLinkText(navigator, url).then(setCopied)}
                      >
                        <Copy aria-hidden="true" className="size-4" />
                        Copy link
                      </button>
                      <a className="btn btn-sm" href={links.apple}>
                        Add to Apple
                      </a>
                      <a className="btn btn-sm" href={links.google} target="_blank" rel="noreferrer">
                        Add to Google
                      </a>
                      <a className="btn btn-sm" href={links.outlook} target="_blank" rel="noreferrer">
                        Add to Outlook
                      </a>
                    </div>
                    <div role="status">
                      {copied === "copied" && <p className="text-success text-sm">Link copied.</p>}
                    </div>
                    {copied === "failed" && (
                      <p className="text-sm" role="alert">
                        Couldn't copy the link. Select it above and copy it by hand.
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm" data-feed-active="">
                    Your feed is on
                    {settings.feed.rotatedAt ? ` (link made ${madeOn(settings.feed.rotatedAt)})` : ""}. For
                    safety the link is shown only when it's made. Regenerate it to get a new one.
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="btn btn-sm"
                    disabled={!online || busy}
                    data-feed-regenerate=""
                    onClick={() => setConfirming(true)}
                  >
                    <RefreshCw aria-hidden="true" className="size-4" />
                    Regenerate
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-ghost"
                    disabled={!online || busy}
                    data-feed-revoke=""
                    onClick={() => send("feedRevoke")}
                  >
                    <Link2Off aria-hidden="true" className="size-4" />
                    Revoke
                  </button>
                </div>
              </>
            )}
          </>
        )}
        <p role="status" className="text-sm empty:hidden">
          {busy ? "Working…" : ""}
        </p>
        {failed && (
          <p role="alert" className="text-error text-sm">
            {failed}
          </p>
        )}
      </SettingsCard>
      <ConfirmDialog
        open={confirming}
        title="Regenerate the feed link?"
        message={REGENERATE_WARNING}
        confirmLabel="Regenerate"
        onClose={() => setConfirming(false)}
        onConfirm={() => {
          setConfirming(false);
          send("feedRotate");
        }}
      />
    </>
  );
}
