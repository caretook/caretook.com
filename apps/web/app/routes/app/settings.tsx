import type { Measure, TimelineView, UnitChoices } from "@caretook/data/schema";
import type { Route } from "./+types/settings";
import type { ActionResult } from "~/lib/api";

import { UNIT_LABEL, UNIT_OPTIONS, unitChoicesZSchema } from "@caretook/data/schema";
import { useRef, useState } from "react";
import { useFetcher } from "react-router";
import { toActionResult } from "~/lib/api";
import { formString } from "~/lib/form";
import { loadSettings, saveSettings } from "~/lib/me";
import { rpc } from "~/lib/rpc";
import { requireSession } from "~/lib/session";

// Shared by web + native: client-only data (clientLoader/clientAction over oRPC).

export const meta = () => [{ title: "Settings · Caretook" }];

export async function clientLoader({ request }: Route.ClientLoaderArgs) {
  const { user } = await requireSession(request);
  // The device-side read the timeline uses: it sends a layout change that's
  // still pending first, so this page never shows an older choice.
  const settings = await loadSettings(request, user.id);
  return { userId: user.id, ...settings };
}

const TIMELINE_VIEW_OPTIONS: { view: TimelineView; label: string }[] = [
  { view: "rows", label: "Rows" },
  { view: "cards", label: "Cards" },
];

const MEASURES: { measure: Measure; label: string }[] = [
  { measure: "temperature", label: "Temperature" },
  { measure: "weight", label: "Weight" },
  { measure: "glucose", label: "Blood sugar" },
  { measure: "volume", label: "Fluid volume" },
];

export async function clientAction({ request }: Route.ClientActionArgs): Promise<ActionResult> {
  const form = await request.formData();
  const units = Object.fromEntries(MEASURES.map(({ measure }) => [measure, formString(form, measure)]));
  const parsed = unitChoicesZSchema.safeParse(units);
  if (!parsed.success) return { ok: false, error: "Choose a unit for each measurement.", issues: [] };
  try {
    await rpc.me.updatePreferences({ units: parsed.data });
    return { ok: true };
  } catch (e) {
    // No connection (fetch's TypeError): units still need one to save.
    if (e instanceof TypeError)
      return { ok: false, error: "You're offline. Connect to save your units.", issues: [] };
    return toActionResult(e);
  }
}

export default function Settings({ loaderData }: Route.ComponentProps) {
  const { userId, units, timelineView } = loaderData;
  const fetcher = useFetcher<ActionResult>();
  const busy = fetcher.state !== "idle";
  const result = fetcher.state === "idle" ? fetcher.data : undefined;

  return (
    <main className="mx-auto max-w-2xl space-y-6 px-4 py-6">
      <h1 className="text-2xl font-semibold">Settings</h1>

      <section aria-labelledby="units-heading" className="card bg-base-100 shadow-sm">
        <fetcher.Form method="post" className="card-body">
          <h2 id="units-heading" className="card-title text-lg">
            Units
          </h2>
          <p className="text-base-content/70 text-sm">
            How vitals show for you. Everyone in your care groups can pick their own.
          </p>
          {MEASURES.map(({ measure, label }) => (
            <UnitChoice key={measure} measure={measure} label={label} value={units[measure]} />
          ))}
          <div className="flex items-center gap-3 pt-2">
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? "Saving…" : "Save"}
            </button>
            {result?.ok && (
              <p role="status" className="text-success text-sm">
                Saved.
              </p>
            )}
            {result && !result.ok && (
              <p role="alert" className="text-error text-sm">
                {result.error}
              </p>
            )}
          </div>
        </fetcher.Form>
      </section>

      <TimelineLayout userId={userId} initial={timelineView} />
    </main>
  );
}

type LayoutStatus = "saving" | "saved" | "pending" | "failed";

/**
 * Rows or cards: the preference the timeline's own toggle changes, saved the
 * same way (`saveSettings`), as soon as it's chosen. Offline, it's kept on
 * this device and sent on the next online visit.
 */
function TimelineLayout({ userId, initial }: { userId: string; initial: TimelineView }) {
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
    <section aria-labelledby="layout-heading" className="card bg-base-100 shadow-sm">
      <div className="card-body">
        <h2 id="layout-heading" className="card-title text-lg">
          Timeline layout
        </h2>
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
    </section>
  );
}

function UnitChoice({
  measure,
  label,
  value,
}: {
  measure: Measure;
  label: string;
  value: UnitChoices[Measure];
}) {
  return (
    <fieldset className="fieldset">
      <legend className="fieldset-legend">{label}</legend>
      <div className="join">
        {UNIT_OPTIONS[measure].map((unit) => (
          <input
            key={unit}
            type="radio"
            name={measure}
            value={unit}
            aria-label={UNIT_LABEL[unit]}
            defaultChecked={value === unit}
            className="join-item btn btn-sm"
          />
        ))}
      </div>
    </fieldset>
  );
}
