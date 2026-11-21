import type { ReminderLead } from "@caretook/data/schema";
import type { RemindChoice, RemindSettings } from "~/lib/calendars/remindMe";

import { ORPCError } from "@orpc/client";
import { useEffect, useState } from "react";
import { Sheet } from "~/components/ui";
import { REMIND_OFFLINE, remindSummary } from "~/lib/calendars/remindMe";
import { rpc } from "~/lib/core/rpc";
import { LEADS_CAP_NOTE, leadChoices, withLead } from "~/routes/app/groups/settings/calendar/reminderChoices";

type Mode = RemindChoice["mode"];

const MODES: { mode: Mode; label: string }[] = [
  { mode: "default", label: "Use my settings" },
  { mode: "mute", label: "No reminders for this one" },
  { mode: "extra", label: "Also remind me" },
];

type Loaded = { settings: RemindSettings; choice: RemindChoice };

/**
 * "Remind me" for one appointment or reminder, from its ⋯ menu: Use my
 * settings, No reminders for this one, or Also remind me (lead choices, up to
 * three), with a line saying what will be sent. The member's own choice, any
 * role. It lives on the server only, so offline the sheet says it needs a
 * connection.
 */
export function RemindMeSheet({
  groupId,
  entryId,
  title,
  onClose,
}: {
  groupId: string;
  entryId: string;
  title: string;
  onClose: () => void;
}) {
  const [loaded, setLoaded] = useState<Loaded | "offline" | "loading">(() =>
    typeof navigator !== "undefined" && !navigator.onLine ? "offline" : "loading",
  );
  const [mode, setMode] = useState<Mode>("default");
  const [leads, setLeads] = useState<ReminderLead[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loaded !== "loading") return;
    let alive = true;
    void Promise.all([
      rpc.calendars.settings.get({ groupId }),
      rpc.calendars.overrides.get({ groupId, entryId }),
    ]).then(
      ([settings, choice]) => {
        if (!alive) return;
        setLoaded({ settings, choice });
        setMode(choice.mode);
        setLeads(choice.mode === "extra" ? choice.leads : []);
      },
      () => alive && setLoaded("offline"),
    );
    return () => {
      alive = false;
    };
  }, [loaded, groupId, entryId]);

  const current = (): RemindChoice =>
    mode === "extra" ? { mode, leads } : mode === "mute" ? { mode } : { mode: "default" };

  const save = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await rpc.calendars.overrides.set({ groupId, entryId, choice: current() });
      onClose();
    } catch (e) {
      setBusy(false);
      setError(
        e instanceof TypeError
          ? REMIND_OFFLINE
          : e instanceof ORPCError && e.message
            ? e.message
            : "Couldn't save that. Try again.",
      );
    }
  };

  const ready = typeof loaded === "object";
  return (
    <Sheet isOpen onOpenChange={(open) => !open && onClose()} title={`Remind me: ${title}`}>
      {loaded === "offline" ? (
        <p data-remind-offline="" role="status">
          {REMIND_OFFLINE}
        </p>
      ) : !ready ? (
        <p className="text-base-content/70 text-sm" role="status">
          Loading…
        </p>
      ) : (
        <form
          className="space-y-3"
          data-remind-sheet=""
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <fieldset className="space-y-2">
            <legend className="sr-only">Reminders for this one</legend>
            {MODES.map((m) => (
              <label key={m.mode} className="flex cursor-pointer items-center gap-3">
                <input
                  type="radio"
                  name="remind-mode"
                  className="radio radio-sm"
                  value={m.mode}
                  checked={mode === m.mode}
                  onChange={() => setMode(m.mode)}
                />
                <span>{m.label}</span>
              </label>
            ))}
          </fieldset>
          {mode === "extra" && (
            <fieldset className="flex flex-col gap-2 pl-8" data-remind-leads="">
              <legend className="mb-1 text-sm font-medium">When</legend>
              {leadChoices(leads).map((choice) => (
                <label key={choice.lead} className="flex cursor-pointer items-center gap-3">
                  <input
                    type="checkbox"
                    className="checkbox checkbox-sm"
                    checked={choice.checked}
                    disabled={choice.disabled}
                    onChange={(e) => setLeads(withLead(leads, choice.lead, e.target.checked))}
                  />
                  <span>{choice.label}</span>
                </label>
              ))}
              <p className="text-base-content/70 text-sm">{LEADS_CAP_NOTE}</p>
            </fieldset>
          )}
          <p className="text-base-content/70 text-sm" data-remind-summary="" aria-live="polite">
            {remindSummary(current(), loaded.settings)}
          </p>
          {error && (
            <p role="alert" className="text-error text-sm">
              {error}
            </p>
          )}
          <button
            type="submit"
            className="btn btn-primary btn-block"
            disabled={busy || (mode === "extra" && !leads.length)}
          >
            {busy ? "Saving…" : "Save"}
          </button>
        </form>
      )}
    </Sheet>
  );
}
