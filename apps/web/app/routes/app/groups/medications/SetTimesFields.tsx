import type { Dispatch, SetStateAction } from "react";
import type { FieldIssue } from "~/lib/core/api";
import type { LocalPass } from "~/lib/medications/medicationPasses.sync";
import type { TimeRow } from "./scheduleSlots";

import { Plus, X } from "lucide-react";
import { useId } from "react";
import { Link } from "react-router";
import { MEDICATION_LIMITS, clockTime } from "@caretook/data/schema";
import { Button, CheckField, EmptyState, Field, IconButton, LINK, TimeSelect } from "~/components/ui";
import { currentHourTime } from "~/lib/core/timeOfDay";
import { FIELD, passAmountField } from "./medicationFormData";

const issueFor = (issues: FieldIssue[], path: string) => issues.find((i) => i.path === path)?.message;

/** Ticked live passes by id, each with its amount ("" for the usual dose). */
export type TickedPasses = Record<string, { amount: string }>;

/**
 * At set times' slots (inside `ScheduleFields`' overlay): the group's live
 * passes to tick, each with an amount when it differs from the usual dose,
 * then times of their own ("Add another time"), each with its own amount. Up
 * to 8 in all. The state is the caller's, so its summary reads it.
 */
export function SetTimesFields({
  live,
  ticked,
  setTicked,
  times,
  setTimes,
  placeholder,
  passesHref,
  zone,
  issues,
}: {
  /** The group's live passes. */
  live: readonly LocalPass[];
  ticked: TickedPasses;
  setTicked: Dispatch<SetStateAction<TickedPasses>>;
  times: readonly TimeRow[];
  setTimes: Dispatch<SetStateAction<TimeRow[]>>;
  /** The amounts' placeholder: the usual dose as typed. */
  placeholder: string;
  passesHref: string;
  /** The recipient's zone: a new time starts at their current hour. */
  zone: string;
  issues: FieldIssue[];
}) {
  const id = useId();
  const timesError = issueFor(issues, "schedule.times");
  const passesError = issueFor(issues, "schedule.passes");
  const count = Object.keys(ticked).length + times.length;

  const setTime = (key: number, change: Partial<TimeRow>) =>
    setTimes((all) => all.map((t) => (t.key === key ? { ...t, ...change } : t)));

  return (
    <>
      <fieldset
        className="fieldset"
        aria-labelledby={`${id}-passes`}
        aria-describedby={passesError ? `${id}-passes-error` : undefined}
        aria-invalid={passesError ? true : undefined}
        data-schedule-passes
      >
        <div className="flex items-baseline justify-between gap-2">
          <span id={`${id}-passes`} className="fieldset-legend">
            Med times
          </span>
          <Link to={passesHref} className={`${LINK} text-sm`} data-manage-passes>
            Manage med times
          </Link>
        </div>
        {live.length === 0 ? (
          <EmptyState>No med times yet. Add Morning or Evening on Med times.</EmptyState>
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
                  <CheckField
                    className="min-h-10 min-w-40 content-center"
                    label={
                      <>
                        <span className="font-medium">{pass.name}</span>{" "}
                        <span className="text-muted">{clockTime(pass.time)}</span>
                      </>
                    }
                    name={FIELD.passId}
                    value={pass.id}
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
                  {slot && (
                    <Field
                      label={`Amount at ${pass.name}`}
                      labelHidden
                      className="w-44"
                      error={amountError}
                      kind="input"
                    >
                      {(control) => (
                        <input
                          {...control}
                          name={passAmountField(pass.id)}
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
          <p id={`${id}-passes-error`} className="text-error-ink text-sm">
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
                  kind="input"
                >
                  {(control) => (
                    <input
                      {...control}
                      name={FIELD.timeAmount}
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
          <Button
            variant="ghost"
            size="sm"
            icon={Plus}
            className="self-start"
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
            data-add-time=""
          >
            {live.length ? "Add another time" : "Add a time"}
          </Button>
        )}
        {timesError && (
          <p id={`${id}-times-error`} className="text-error-ink text-sm">
            {timesError}
          </p>
        )}
      </fieldset>
    </>
  );
}
