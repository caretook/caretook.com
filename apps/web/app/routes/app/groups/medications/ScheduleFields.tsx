import type { FieldIssue } from "~/lib/api";
import type { MedicationSchedule } from "@caretook/data/schema";

import { Plus, X } from "lucide-react";
import { useId, useState } from "react";
import { MEDICATION_LIMITS, ownTimes } from "@caretook/data/schema";
import { ChoiceGroup, Field, IconButton } from "~/components/ui";
import { FIELD } from "./medicationFormData";

type ScheduleType = MedicationSchedule["type"];

const TYPE_OPTIONS = [
  { value: "scheduled", label: "At set times" },
  { value: "asNeeded", label: "As needed" },
] as const satisfies readonly { value: ScheduleType; label: string }[];

const issueFor = (issues: FieldIssue[], path: string) => issues.find((i) => i.path === path)?.message;

/**
 * The schedule: at set times every day (up to 8, each a time input, in the
 * recipient's time zone) or as needed (with an optional most-in-a-day). The
 * shared schema's messages show on the times ("List each time once") and
 * the maximum ("At most 24 a day").
 */
export function ScheduleFields({
  initial,
  issues,
  zoneNote,
}: {
  initial: MedicationSchedule | null;
  issues: FieldIssue[];
  /** "Times are Los Angeles time", when the device is in another zone. */
  zoneNote: string | null;
}) {
  const [type, setType] = useState<ScheduleType>(initial?.type ?? "scheduled");
  // Each row keeps its key as rows come and go, so typing stays in its field.
  const [times, setTimes] = useState(() =>
    (initial?.type === "scheduled" && ownTimes(initial).length ? ownTimes(initial) : ["08:00"]).map(
      (value, key) => ({ key, value }),
    ),
  );
  const timesId = useId();
  const timesError = issueFor(issues, "schedule.times");

  return (
    <div className="space-y-1" data-schedule>
      <ChoiceGroup
        name={FIELD.scheduleType}
        label="Schedule"
        options={TYPE_OPTIONS}
        value={type}
        onChange={setType}
        error={issueFor(issues, "schedule")}
      />
      {type === "scheduled" ? (
        <fieldset
          className="fieldset"
          aria-labelledby={`${timesId}-label`}
          aria-describedby={`${timesId}-help${timesError ? ` ${timesId}-error` : ""}`}
          aria-invalid={timesError ? true : undefined}
          data-schedule-times
        >
          <span id={`${timesId}-label`} className="fieldset-legend">
            Times each day
          </span>
          <p id={`${timesId}-help`} className="label text-base-content/70 whitespace-normal">
            {zoneNote ? `Every day. ${zoneNote}.` : "Every day."}
          </p>
          <ul className="space-y-1.5">
            {times.map((time, index) => (
              <li key={time.key} className="flex items-start gap-1">
                <Field
                  label={`Time ${index + 1}`}
                  labelHidden
                  className="w-40"
                  error={issueFor(issues, `schedule.times.${index}`)}
                >
                  {(control) => (
                    <input
                      {...control}
                      type="time"
                      name={FIELD.time}
                      className="input w-full"
                      value={time.value}
                      onChange={(e) =>
                        setTimes((all) =>
                          all.map((t) => (t.key === time.key ? { ...t, value: e.target.value } : t)),
                        )
                      }
                    />
                  )}
                </Field>
                {times.length > 1 && (
                  <IconButton
                    label={`Remove time ${index + 1}`}
                    icon={X}
                    className="mt-1.5"
                    onPress={() => setTimes((all) => all.filter((t) => t.key !== time.key))}
                  />
                )}
              </li>
            ))}
          </ul>
          {times.length < MEDICATION_LIMITS.scheduleTimes && (
            <button
              type="button"
              className="btn btn-ghost btn-sm self-start"
              onClick={() =>
                setTimes((all) => [...all, { key: Math.max(-1, ...all.map((t) => t.key)) + 1, value: "" }])
              }
              data-add-time
            >
              <Plus className="size-4" aria-hidden="true" />
              Add a time
            </button>
          )}
          {timesError && (
            <p id={`${timesId}-error`} className="text-error text-sm">
              {timesError}
            </p>
          )}
        </fieldset>
      ) : (
        <Field
          label="Most in a day (optional)"
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
