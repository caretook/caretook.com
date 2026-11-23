import type { FieldIssue } from "~/lib/core/api";
import type { LocalPass } from "~/lib/medications/medicationPasses.sync";
import type { MedicationSchedule } from "@caretook/data/schema";

import { Plus, X } from "lucide-react";
import { useId, useState } from "react";
import { Link } from "react-router";
import { MEDICATION_LIMITS } from "@caretook/data/schema";
import { ChoiceGroup, Field, IconButton, TimeSelect } from "~/components/ui";
import { useGroup } from "~/lib/app-shell/group";
import { localTimeZone } from "~/lib/core/format";
import { currentHourTime } from "~/lib/core/timeOfDay";
import { clockTime } from "~/lib/medications/medicationDisplay";
import { FIELD, passAmountField } from "./medicationFormData";
import { initialSlots } from "./scheduleSlots";

type ScheduleType = MedicationSchedule["type"];

const TYPE_OPTIONS = [
  { value: "scheduled", label: "At set times" },
  { value: "asNeeded", label: "As needed" },
] as const satisfies readonly { value: ScheduleType; label: string }[];

const issueFor = (issues: FieldIssue[], path: string) => issues.find((i) => i.path === path)?.message;

/**
 * The schedule: at set times every day (in the recipient's time zone) or as
 * needed (with an optional most-in-a-day). At set times is the group's passes
 * to tick (Morning, Evening…), each with an amount when it differs from the
 * usual dose, plus times of their own ("Add another time"), each with its
 * own amount. Up to 8 in all. The shared schema's messages show on the rows
 * ("List each time once") and the maximum ("At most 24 a day").
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
  const [type, setType] = useState<ScheduleType>(initial?.type ?? "scheduled");
  const [start] = useState(() => initialSlots(initial, passes));
  const [ticked, setTicked] = useState(start.passes);
  // Each row keeps its key as rows come and go, so typing stays in its field.
  const [times, setTimes] = useState(start.times);
  const id = useId();
  // Schedule times are the recipient's, so a new one starts at their current hour.
  const zone = useGroup().recipient?.timeZone ?? localTimeZone();
  const timesError = issueFor(issues, "schedule.times");
  const passesError = issueFor(issues, "schedule.passes");
  const live = passes.filter((p) => !p.deletedAt);
  const count = Object.keys(ticked).length + times.length;
  const placeholder = dose.trim() || "Usual dose";

  const setTime = (key: number, change: Partial<(typeof times)[number]>) =>
    setTimes((all) => all.map((t) => (t.key === key ? { ...t, ...change } : t)));

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
        <>
          <p className="text-base-content/70 text-sm">
            {zoneNote ? `Every day. ${zoneNote}.` : "Every day."}
          </p>
          {start.unknown.map((passId) => (
            // A pass this device doesn't have yet: kept as it is.
            <input key={passId} type="hidden" name={FIELD.passId} value={passId} />
          ))}
          <fieldset
            className="fieldset"
            aria-labelledby={`${id}-passes`}
            aria-describedby={passesError ? `${id}-passes-error` : undefined}
            aria-invalid={passesError ? true : undefined}
            data-schedule-passes
          >
            <div className="flex items-baseline justify-between gap-2">
              <span id={`${id}-passes`} className="fieldset-legend">
                Passes
              </span>
              <Link to={passesHref} className="link link-hover text-sm" data-manage-passes>
                Manage passes
              </Link>
            </div>
            {live.length === 0 ? (
              <p className="text-base-content/70 text-sm">No passes yet. Add Morning or Evening on Passes.</p>
            ) : (
              <ul className="space-y-1.5">
                {live.map((pass) => {
                  const slot = ticked[pass.id];
                  const amountError = issueFor(issues, `schedule.passes.${pass.id}.amount`);
                  return (
                    <li
                      key={pass.id}
                      className="flex flex-wrap items-start gap-x-3 gap-y-1"
                      data-pass-slot={pass.id}
                    >
                      <label className="label text-base-content min-h-10 min-w-40 cursor-pointer gap-3 whitespace-normal">
                        <input
                          type="checkbox"
                          name={FIELD.passId}
                          value={pass.id}
                          className="checkbox checkbox-sm"
                          checked={!!slot}
                          disabled={!slot && count >= MEDICATION_LIMITS.scheduleTimes}
                          onChange={(e) => {
                            const on = e.target.checked;
                            setTicked((all) =>
                              on
                                ? { ...all, [pass.id]: { amount: "" } }
                                : Object.fromEntries(Object.entries(all).filter(([key]) => key !== pass.id)),
                            );
                          }}
                        />
                        <span>
                          <span className="font-medium">{pass.name}</span>{" "}
                          <span className="text-base-content/70">{clockTime(pass.time)}</span>
                        </span>
                      </label>
                      {slot && (
                        <Field
                          label={`Amount at ${pass.name}`}
                          labelHidden
                          className="w-44"
                          error={amountError}
                        >
                          {(control) => (
                            <input
                              {...control}
                              name={passAmountField(pass.id)}
                              className="input w-full"
                              maxLength={MEDICATION_LIMITS.doseAmount}
                              placeholder={placeholder}
                              autoComplete="off"
                              value={slot.amount}
                              onChange={(e) =>
                                setTicked((all) => ({ ...all, [pass.id]: { amount: e.target.value } }))
                              }
                            />
                          )}
                        </Field>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
            {passesError && (
              <p id={`${id}-passes-error`} className="text-error text-sm">
                {passesError}
              </p>
            )}
          </fieldset>

          <fieldset
            className="fieldset"
            aria-labelledby={`${id}-times`}
            aria-describedby={timesError ? `${id}-times-error` : undefined}
            aria-invalid={timesError ? true : undefined}
            data-schedule-times
          >
            <span id={`${id}-times`} className="fieldset-legend">
              {live.length ? "Other times" : "Times each day"}
            </span>
            {times.length > 0 && (
              <ul className="space-y-1.5">
                {times.map((time, index) => (
                  <li key={time.key} className="flex flex-wrap items-start gap-x-1 gap-y-1" data-time-slot>
                    <TimeSelect
                      label={`Time ${index + 1}`}
                      labelHidden
                      name={FIELD.time}
                      className="w-44"
                      timeZone={zone}
                      error={issueFor(issues, `schedule.times.${index}`)}
                      value={time.value}
                      onChange={(value) => setTime(time.key, { value })}
                    />
                    <Field
                      label={`Amount at time ${index + 1}`}
                      labelHidden
                      className="w-44"
                      error={issueFor(issues, `schedule.times.${index}.amount`)}
                    >
                      {(control) => (
                        <input
                          {...control}
                          name={FIELD.timeAmount}
                          className="input w-full"
                          maxLength={MEDICATION_LIMITS.doseAmount}
                          placeholder={placeholder}
                          autoComplete="off"
                          value={time.amount}
                          onChange={(e) => setTime(time.key, { amount: e.target.value })}
                        />
                      )}
                    </Field>
                    <IconButton
                      label={`Remove time ${index + 1}`}
                      icon={X}
                      className="mt-1.5"
                      onPress={() => setTimes((all) => all.filter((t) => t.key !== time.key))}
                    />
                  </li>
                ))}
              </ul>
            )}
            {count < MEDICATION_LIMITS.scheduleTimes && (
              <button
                type="button"
                className="btn btn-ghost btn-sm self-start"
                onClick={() =>
                  setTimes((all) => [
                    ...all,
                    {
                      key: Math.max(-1, ...all.map((t) => t.key)) + 1,
                      value: currentHourTime(zone),
                      amount: "",
                    },
                  ])
                }
                data-add-time
              >
                <Plus className="size-4" aria-hidden="true" />
                {live.length ? "Add another time" : "Add a time"}
              </button>
            )}
            {timesError && (
              <p id={`${id}-times-error`} className="text-error text-sm">
                {timesError}
              </p>
            )}
          </fieldset>
        </>
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
