import type { FieldIssue } from "~/lib/core/api";
import type { LocalPass } from "~/lib/medications/medicationPasses.sync";
import type { MedicationSchedule, ScheduleSlot } from "@caretook/data/schema";

import { useEffect, useId, useRef, useState } from "react";
import { MEDICATION_LIMITS, scheduleText } from "@caretook/data/schema";
import { Button, ChoiceGroup, Field, TITLE_SECTION } from "~/components/ui";
import { useGroup } from "~/lib/app-shell/group";
import { localTimeZone } from "~/lib/core/format";
import { FIELD } from "~/lib/medications/medicationFormData";
import { initialSlots } from "~/lib/medications/scheduleSlots";
import { SetTimesFields } from "./SetTimesFields";

type ScheduleType = MedicationSchedule["type"];

const TYPE_OPTIONS = [
  { value: "scheduled", label: "At set times" },
  { value: "asNeeded", label: "As needed" },
] as const satisfies readonly { value: ScheduleType; label: string }[];

const issueFor = (issues: FieldIssue[], path: string) => issues.find((i) => i.path === path)?.message;
/** An issue shown inside the set times overlay. */
const inOverlay = (path: string) => /^schedule\.(times|passes)(\.|$)/.test(path);

const OVERLAY = "dialog[data-schedule-overlay]";

/**
 * Opens the set times overlay holding `field`, if it's closed, and focuses the
 * field: for a refusal about a slot (after `revealField`, which can't focus a
 * field in a closed dialog). Returns whether it opened one.
 */
export function revealInSchedule(field: Element) {
  const dialog = field.closest<HTMLDialogElement>(OVERLAY);
  if (!dialog || dialog.open || !(field instanceof HTMLElement)) return false;
  dialog.showModal();
  field.focus();
  return true;
}

/**
 * The schedule: a new medication starts as needed (an existing one keeps its
 * own); at set times every day (in the recipient's time zone) or as
 * needed (with an optional most-in-a-day). Choosing At set times opens an
 * overlay (a native modal `<dialog>` inside the form, so its fields stay
 * mounted: they submit, and the discard prompt counts them) with the group's
 * passes to tick and times of their own (`SetTimesFields`); closing it leaves
 * a one-line summary with Edit times, so Essentials stays about a phone
 * screen. The shared schema's messages show on the rows ("List each time
 * once"), the first of them under the summary too, and the maximum ("At most
 * 24 a day").
 */
export function ScheduleFields({
  initial,
  passes,
  dose,
  passesHref,
  issues,
  zoneNote,
}: {
  initial: MedicationSchedule | null;
  /** The group's passes, deleted ones too (`useSchedulePasses`). */
  passes: readonly LocalPass[];
  /** The usual dose as typed: the amounts' placeholder. */
  dose: string;
  /** The Passes screen. */
  passesHref: string;
  issues: FieldIssue[];
  /** "Times are Los Angeles time", when the device is in another zone. */
  zoneNote: string | null;
}) {
  const [type, setType] = useState<ScheduleType>(initial?.type ?? "asNeeded");
  const [start] = useState(() => initialSlots(initial, passes));
  const [ticked, setTicked] = useState(start.passes);
  // Each row keeps its key as rows come and go, so typing stays in its field.
  const [times, setTimes] = useState(start.times);
  const id = useId();
  const overlay = useRef<HTMLDialogElement>(null);
  // Choosing At set times opens the overlay once it has rendered.
  const openNext = useRef(false);
  useEffect(() => {
    if (type !== "scheduled" || !openNext.current) return;
    openNext.current = false;
    if (overlay.current && !overlay.current.open) overlay.current.showModal();
  }, [type]);

  // Schedule times are the recipient's, so a new one starts at their current hour.
  const zone = useGroup().recipient?.timeZone ?? localTimeZone();
  const live = passes.filter((p) => !p.deletedAt);
  const everyDay = zoneNote ? `Every day. ${zoneNote}.` : "Every day.";
  const slots: ScheduleSlot[] = [
    ...live.flatMap((p) =>
      ticked[p.id] ? [{ passId: p.id, amount: ticked[p.id]?.amount.trim() || undefined }] : [],
    ),
    ...times.map((t) => ({ time: t.value, amount: t.amount.trim() || undefined })),
  ];
  const overlayError = issues.find((i) => inOverlay(i.path))?.message;

  return (
    <div className="space-y-1" data-schedule>
      <ChoiceGroup
        name={FIELD.scheduleType}
        label="Schedule"
        options={TYPE_OPTIONS}
        value={type}
        onChange={(next) => {
          openNext.current = next === "scheduled";
          setType(next);
        }}
        error={issueFor(issues, "schedule")}
        required
      />
      {type === "scheduled" ? (
        <>
          <div className="flex items-start justify-between gap-3" data-schedule-summary>
            <div className="min-w-0 text-sm">
              <p data-schedule-summary-text>
                {slots.length
                  ? scheduleText({ type: "scheduled", slots }, live, dose)
                  : "No times chosen yet."}
              </p>
              <p className="text-muted">{everyDay}</p>
              {overlayError && (
                <p className="text-error-ink" data-schedule-summary-error>
                  {overlayError}
                </p>
              )}
            </div>
            <Button
              size="sm"
              className="shrink-0"
              onClick={() => overlay.current?.showModal()}
              aria-haspopup="dialog"
              data-edit-schedule=""
            >
              {slots.length ? "Edit times" : "Choose times"}
            </Button>
          </div>
          {start.unknown.map((passId) => (
            // A pass this device doesn't have yet: kept as it is.
            <input key={passId} type="hidden" name={FIELD.passId} value={passId} />
          ))}
          {/* Escape closes only the overlay, never the sheet it's in. */}
          <dialog
            ref={overlay}
            className="modal"
            aria-labelledby={`${id}-title`}
            onKeyDown={(e) => e.key === "Escape" && e.stopPropagation()}
            data-schedule-overlay=""
          >
            <div className="modal-box space-y-1">
              <h2 id={`${id}-title`} className={TITLE_SECTION}>
                At set times
              </h2>
              <p className="text-muted text-sm">{everyDay}</p>
              <SetTimesFields
                live={live}
                ticked={ticked}
                setTicked={setTicked}
                times={times}
                setTimes={setTimes}
                placeholder={dose.trim() || "Usual dose"}
                passesHref={passesHref}
                zone={zone}
                issues={issues}
              />
              <div className="modal-action">
                <Button variant="primary" onClick={() => overlay.current?.close()} data-schedule-done="">
                  Done
                </Button>
              </div>
            </div>
          </dialog>
        </>
      ) : (
        <Field
          label="Most in a day"
          help="Logging past it shows a warning, never a block."
          error={issueFor(issues, "schedule.maxPerDay")}
        >
          {(control) => (
            <input
              {...control}
              type="number"
              inputMode="numeric"
              name={FIELD.maxPerDay}
              min={1}
              max={MEDICATION_LIMITS.maxPerDay}
              step={1}
              className="input w-32"
              defaultValue={initial?.type === "asNeeded" ? (initial.maxPerDay ?? "") : ""}
            />
          )}
        </Field>
      )}
    </div>
  );
}
