import type { PlanSeries, SeriesEditChange } from "@caretook/data/series";

import { parseRule, ruleText, SERIES_LIMITS } from "@caretook/data/schema";
import { ruleFrom } from "@caretook/data/series";
import { useState } from "react";
import { Field, FormFooter, Message, Sheet, TimeSelect, ToggleField } from "~/components/ui";
import { choiceOfRule } from "~/lib/appointments/repeatChoice";
import { currentHourTime } from "~/lib/core/timeOfDay";
import { repeatOutcome, RepeatField } from "./RepeatField";

/** "HH:MM" plus minutes, as a wall-clock time (past midnight wraps). */
const addMinutes = (time: string, minutes: number) => {
  const [h, m] = time.split(":").map(Number);
  const total = ((h ?? 0) * 60 + (m ?? 0) + minutes) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
};

/** The minutes from one wall-clock time to a later one (an end before the start is the next day). */
const minutesFrom = (start: string, end: string) => {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const diff = (eh ?? 0) * 60 + (em ?? 0) - ((sh ?? 0) * 60 + (sm ?? 0));
  return diff > 0 ? diff : diff + 1440;
};

/** The rule a series ends with after one more visit ("Doesn't repeat" from here). */
const justThisOne = (rule: string) => {
  const parsed = parseRule(rule);
  return parsed.ok ? ruleText({ ...parsed.rule, end: { type: "after", count: 1 } }) : rule;
};

/**
 * Editing a series from one visit on ("This and later visits"): its title,
 * time (or all day), an appointment's end and place, and how it repeats
 * (`RepeatField`, prefilled; an "after N" end counts only what's left).
 * Save hands the change to the caller, which plans and writes it. Past
 * visits never change.
 */
export function SeriesEditSheet({
  series,
  fromDay,
  onSave,
  onClose,
  error,
}: {
  series: PlanSeries;
  /** The visit's series day: the new series starts here. */
  fromDay: string;
  onSave: (change: Extract<SeriesEditChange, { action: "edit" }>) => void;
  onClose: () => void;
  /** Why the last save didn't go through. */
  error?: string | null;
}) {
  const event = series.kind === "event";
  const [title, setTitle] = useState(series.title ?? "");
  const [place, setPlace] = useState(series.place ?? "");
  const [allDay, setAllDay] = useState(series.allDay);
  const [startTime, setStartTime] = useState(() => series.startTime ?? currentHourTime(series.timeZone));
  const [endTime, setEndTime] = useState(
    series.durationMinutes ? addMinutes(startTime, series.durationMinutes) : "",
  );
  const [choice, setChoice] = useState(() => choiceOfRule(ruleFrom(series, fromDay), fromDay));

  const durationMinutes = event && !allDay && endTime ? minutesFrom(startTime, endTime) : null;
  const timing = {
    startsOn: fromDay,
    startTime: allDay ? null : startTime,
    allDay,
    timeZone: series.timeZone,
    durationMinutes,
  };
  const kind = event ? "event" : "note";
  const { rule, problem } = repeatOutcome(choice, timing, kind);
  const missingTitle = event && !title.trim();

  const save = () => {
    if (problem || missingTitle || (!allDay && !startTime)) return;
    onSave({
      action: "edit",
      title: title.trim() || null,
      ...(event && { place: place.trim() || null }),
      allDay,
      startTime: allDay ? null : startTime,
      durationMinutes,
      rule: rule ?? justThisOne(ruleFrom(series, fromDay)),
    });
  };

  return (
    <Sheet guardChanges isOpen onOpenChange={(open) => !open && onClose()} title="Edit this and later visits">
      <form
        className="space-y-4"
        data-series-edit
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <Field label="Title" kind="input" required={event} error={missingTitle ? "Enter a title" : undefined}>
          {(control) => (
            <input
              {...control}
              name="title"
              type="text"
              maxLength={SERIES_LIMITS.title}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          )}
        </Field>
        <ToggleField
          label="All day"
          name="allDay"
          checked={allDay}
          onChange={(e) => setAllDay(e.target.checked)}
        />
        {!allDay && (
          <div className="flex flex-wrap gap-2">
            <TimeSelect
              label={event ? "Starts" : "At"}
              required
              name="startTime"
              className="min-w-0 flex-1"
              value={startTime}
              onChange={setStartTime}
            />
            {event && (
              <TimeSelect
                label="Ends"
                name="endTime"
                optional
                className="min-w-0 flex-1"
                value={endTime}
                onChange={setEndTime}
              />
            )}
          </div>
        )}
        {event && (
          <Field label="Place" kind="input">
            {(control) => (
              <input
                {...control}
                name="place"
                type="text"
                maxLength={SERIES_LIMITS.place}
                value={place}
                onChange={(e) => setPlace(e.target.value)}
              />
            )}
          </Field>
        )}
        <RepeatField choice={choice} onChange={setChoice} timing={timing} kind={kind} />
        <p className="text-muted text-sm">
          Visits from this one on change. Past visits, and ones changed on their own, stay as they are.
        </p>
        {error && <Message tone="error">{error}</Message>}
        <FormFooter submitLabel="Save" cancel={{ label: "Cancel", onCancel: onClose }} />
      </form>
    </Sheet>
  );
}
