import type { RepeatFreq } from "@caretook/data/schema";
import type { SeriesTiming } from "@caretook/data/series";
import type { RepeatChoice, RepeatEndChoice, RepeatPreset } from "~/lib/appointments/repeatChoice";

import {
  parseRule,
  repeatText,
  ruleText,
  seriesCrossFieldIssues,
  WEEKDAYS,
  weekdayName,
} from "@caretook/data/schema";
import { nextVisits } from "@caretook/data/series";
import { ChipGroup, ChoiceGroup, Field } from "~/components/ui";
import { formatTime } from "~/lib/core/format";
import {
  choiceRule,
  monthlyLabels,
  PRESET_LABELS,
  REPEAT_PRESETS,
  toggleWeekday,
  UNIT_LABELS,
} from "~/lib/appointments/repeatChoice";

const visitDay = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

/** A preview line's day ("Wed, Nov 18") and, when timed, its time in the viewer's zone. */
const visitLabel = (visit: { day: string; start: string }, allDay: boolean) => {
  const day = visitDay.format(new Date(`${visit.day}T12:00:00Z`));
  return allDay ? day : `${day}, ${formatTime(visit.start)}`;
};

/** What the field's choice gives: its rule text, or why it can't be saved (null for Doesn't repeat). */
export const repeatOutcome = (
  choice: RepeatChoice,
  timing: Omit<SeriesTiming, "rule">,
  kind: "event" | "note",
) => {
  const rule = choiceRule(choice, timing.startsOn);
  if (!rule) return { rule: null, problem: null };
  const text = ruleText(rule);
  const parsed = parseRule(text);
  if (!parsed.ok) return { rule: null, problem: parsed.problem };
  const issue = seriesCrossFieldIssues({
    kind,
    rule: text,
    startsOn: timing.startsOn,
    startTime: timing.startTime,
    allDay: timing.allDay,
    title: "x",
    durationMinutes: null,
    place: null,
  }).find((i) => i.path === "rule");
  return issue ? { rule: null, problem: issue.message } : { rule: text, problem: null };
};

/**
 * How an appointment or reminder repeats (appointments-2): Doesn't repeat,
 * Daily, Weekly (on chosen days), Monthly (on the date or the nth weekday),
 * or Custom (every N days, weeks or months), and how it ends (never, on a
 * date, after N). A live preview says the rule in words and lists the next
 * three visits. Controlled: the caller holds the choice. Loads rrule (the
 * preview), so pages load it only when it opens.
 */
export function RepeatField({
  choice,
  onChange,
  timing,
  kind,
}: {
  choice: RepeatChoice;
  onChange: (choice: RepeatChoice) => void;
  /** The draft's first day and time, in the recipient's zone. */
  timing: Omit<SeriesTiming, "rule">;
  kind: "event" | "note";
}) {
  const set = (patch: Partial<RepeatChoice>) => onChange({ ...choice, ...patch });
  const freq: RepeatFreq | null =
    choice.preset === "none" ? null : choice.preset === "custom" ? choice.unit : choice.preset;
  const monthly = monthlyLabels(timing.startsOn);
  const { rule, problem } = repeatOutcome(choice, timing, kind);
  const preview = rule ? nextVisits({ ...timing, rule }, timing.startsOn, 3) : [];
  const noun = kind === "note" ? "times" : "visits";

  return (
    <div className="space-y-2" data-repeat-field>
      <Field label="Repeat">
        {(control) => (
          <select
            {...control}
            name="repeat"
            className="select w-full"
            value={choice.preset}
            onChange={(e) => set({ preset: e.target.value as RepeatPreset })}
          >
            {REPEAT_PRESETS.map((preset) => (
              <option key={preset} value={preset}>
                {PRESET_LABELS[preset]}
              </option>
            ))}
          </select>
        )}
      </Field>

      {choice.preset === "custom" && (
        <div className="flex items-end gap-2">
          <Field label="Every" className="w-24">
            {(control) => (
              <input
                {...control}
                name="interval"
                type="number"
                inputMode="numeric"
                min={1}
                max={99}
                className="input w-full"
                value={choice.interval}
                onChange={(e) => set({ interval: Number(e.target.value) })}
              />
            )}
          </Field>
          <Field label="Unit" labelHidden className="flex-1">
            {(control) => (
              <select
                {...control}
                name="unit"
                className="select w-full"
                value={choice.unit}
                onChange={(e) => set({ unit: e.target.value as RepeatFreq })}
              >
                {(["daily", "weekly", "monthly"] as const).map((unit) => (
                  <option key={unit} value={unit}>
                    {choice.interval === 1 ? UNIT_LABELS[unit].one : UNIT_LABELS[unit].many}
                  </option>
                ))}
              </select>
            )}
          </Field>
        </div>
      )}

      {freq === "weekly" && (
        <div className="fieldset">
          <span className="fieldset-legend text-sm">On these days</span>
          <ChipGroup
            label="On these days"
            actions={WEEKDAYS.map((day) => ({
              id: day,
              label: weekdayName(day, "short"),
              pressed: choice.weekdays.includes(day),
              onPress: () => onChange(toggleWeekday(choice, day)),
            }))}
          />
        </div>
      )}

      {freq === "monthly" && (
        <ChoiceGroup
          name="monthlyBy"
          label="Each month"
          options={[
            { value: "date", label: monthly.date },
            { value: "weekday", label: monthly.weekday },
          ]}
          value={choice.monthlyBy}
          onChange={(monthlyBy) => set({ monthlyBy })}
        />
      )}

      {freq && (
        <>
          <ChoiceGroup<RepeatEndChoice>
            name="repeatEnd"
            label="Ends"
            options={[
              { value: "never", label: "Never" },
              { value: "on", label: "On a date" },
              { value: "after", label: `After a number of ${noun}` },
            ]}
            value={choice.end}
            onChange={(end) => set({ end })}
          />
          {choice.end === "on" && (
            <Field label="Last day">
              {(control) => (
                <input
                  {...control}
                  name="until"
                  type="date"
                  min={timing.startsOn}
                  className="input w-full"
                  value={choice.until}
                  onChange={(e) => set({ until: e.target.value })}
                />
              )}
            </Field>
          )}
          {choice.end === "after" && (
            <Field label={`Number of ${noun}`}>
              {(control) => (
                <input
                  {...control}
                  name="count"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={500}
                  className="input w-full"
                  value={choice.count}
                  onChange={(e) => set({ count: Number(e.target.value) })}
                />
              )}
            </Field>
          )}
        </>
      )}

      {freq && (
        <div className="bg-base-200 rounded-box space-y-1 p-3 text-sm" aria-live="polite" data-repeat-preview>
          {problem ? (
            <p className="text-error" data-repeat-problem>
              {problem}
            </p>
          ) : (
            rule && (
              <>
                <p className="font-semibold" data-repeat-text>
                  {repeatText({
                    rule,
                    startTime: timing.startTime,
                    allDay: timing.allDay,
                    startsOn: timing.startsOn,
                    kind,
                  })}
                </p>
                <p className="text-base-content/70">Next:</p>
                <ul className="text-base-content/70" data-repeat-next>
                  {preview.map((visit) => (
                    <li key={visit.day}>{visitLabel(visit, timing.allDay)}</li>
                  ))}
                </ul>
              </>
            )
          )}
        </div>
      )}
    </div>
  );
}
