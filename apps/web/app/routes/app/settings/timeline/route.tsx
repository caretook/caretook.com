import type { TimelineView } from "@caretook/data/schema";
import type { Route } from "./+types/route";

import { useRef, useState } from "react";
import { loadSettings, saveSettings } from "~/lib/me";
import { sessionContext } from "~/lib/session";

// `/app/settings/timeline`. Shared by web + native: client-only data.

export const meta = () => [{ title: "Timeline layout · Settings · Caretook" }];

export async function clientLoader({ request, context }: Route.ClientLoaderArgs) {
  const { user } = context.get(sessionContext);
  // The device-side read the timeline uses: it sends a layout change that's
  // still pending first, so this page never shows an older choice.
  const { timelineView } = await loadSettings(request, user.id);
  return { userId: user.id, timelineView };
}

const TIMELINE_VIEW_OPTIONS: { view: TimelineView; label: string }[] = [
  { view: "rows", label: "Rows" },
  { view: "cards", label: "Cards" },
];

type LayoutStatus = "saving" | "saved" | "pending" | "failed";

/**
 * Rows or cards: the preference the timeline's own toggle changes, saved the
 * same way (`saveSettings`), as soon as it's chosen. Offline, it's kept on
 * this device and sent on the next online visit.
 */
export default function TimelineLayoutSettings({ loaderData }: Route.ComponentProps) {
  const { userId, timelineView: initial } = loaderData;
  const [view, setView] = useState<TimelineView>(initial);
  const [status, setStatus] = useState<LayoutStatus | null>(null);
  // Only the latest choice reports its outcome.
  const latest = useRef(0);

  const choose = (next: TimelineView) => {
    if (next === view) return;
    const mine = ++latest.current;
    setView(next);
    setStatus("saving");
    saveSettings(userId, { timelineView: next }).then(
      (outcome) => mine === latest.current && setStatus(outcome),
      () => mine === latest.current && setStatus("failed"),
    );
  };

  return (
    <section aria-labelledby="layout-heading" className="space-y-4">
      <h1 id="layout-heading" className="text-2xl font-semibold">
        Timeline layout
      </h1>
      <div className="card bg-base-100 shadow-sm">
        <div className="card-body">
          <p className="text-base-content/70 text-sm">
            How entries show on your timelines. You can also switch it on the timeline itself.
          </p>
          <div role="radiogroup" aria-labelledby="layout-heading" className="join">
            {TIMELINE_VIEW_OPTIONS.map(({ view: option, label }) => (
              <input
                key={option}
                type="radio"
                name="timelineView"
                value={option}
                aria-label={label}
                checked={view === option}
                onChange={() => choose(option)}
                className="join-item btn btn-sm"
              />
            ))}
          </div>
          <div className="min-h-5">
            {(status === "saved" || status === "pending") && (
              <p role="status" className="text-success text-sm">
                {status === "saved" ? "Saved." : "Saved on this device. It'll sync when you're back online."}
              </p>
            )}
            {status === "failed" && (
              <p role="alert" className="text-error text-sm">
                Couldn&apos;t save that. Try again.
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
