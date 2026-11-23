import type { CarePeriodType } from "@caretook/data/schema";
import type { ActionResult, FieldIssue } from "~/lib/core/api";
import type { PeriodPrefillValues } from "~/lib/care-periods/periodSheets";
import type { LocalCarePeriod } from "~/lib/care-periods/carePeriods.sync";
import type { LocalProvider } from "~/lib/providers/providers.sync";

import { useEffect, useRef, useState } from "react";
import { useFetcher } from "react-router";
import { CARE_PERIOD_LIMITS, CARE_PERIOD_TYPES } from "@caretook/data/schema";
import { CheckField, ChoiceGroup, Field, FormFooter, Message } from "~/components/ui";
import { DateTimeField } from "~/components/ui/date";
import { PERIOD_TYPE_META } from "~/lib/care-periods/periodDisplay";
import { FIELD, isFieldIssue } from "./periodFormData";
import { PlacePickerField } from "./PlacePickerField";

const issueFor = (issues: FieldIssue[], path: string) => issues.find((i) => i.path === path)?.message;

const TYPE_OPTIONS = CARE_PERIOD_TYPES.map((type) => ({ value: type, label: PERIOD_TYPE_META[type].label }));

/**
 * Start a care period, or add one in the past; with `period`, edit that one
 * (its values fill the form, and a moved start moves its neighbours' ends). Posts to its sheet route's
 * clientAction, which writes on the device (with a place added here, in one
 * transaction); the shared Zod schema's messages show on the fields. The
 * start defaults to now, in the recipient's zone, and can't be later.
 */
export function PeriodForm({
  period,
  prefill,
  providers,
  timeZone,
  zoneNote,
  onDone,
  onCancel,
}: {
  /** The period being edited; the form starts from its values. */
  period?: LocalCarePeriod;
  prefill: PeriodPrefillValues;
  providers: readonly LocalProvider[];
  /** The recipient's zone: the start is shown and saved in it. */
  timeZone: string;
  zoneNote: string | null;
  onDone: () => void;
  onCancel: () => void;
}) {
  const fetcher = useFetcher<ActionResult>();
  const formRef = useRef<HTMLFormElement>(null);
  const result = fetcher.state === "idle" ? fetcher.data : undefined;
  const issues = result && !result.ok ? result.issues : [];
  const busy = fetcher.state !== "idle";
  const start = period
    ? {
        type: period.type,
        startedAt: period.startedAt,
        dateOnly: period.dateOnly,
        placeProviderId: period.placeProviderId,
      }
    : prefill;
  const [type, setType] = useState<CarePeriodType | "">(start.type ?? "");
  const [dateOnly, setDateOnly] = useState(start.dateOnly);
  // The latest start the field takes: now, as the sheet opened.
  const [max] = useState(() => new Date().toISOString());

  // A save closes the sheet; a refusal moves focus to the first field it's about.
  const handled = useRef<ActionResult | undefined>(undefined);
  useEffect(() => {
    if (fetcher.state !== "idle" || !fetcher.data || handled.current === fetcher.data) return;
    handled.current = fetcher.data;
    if (fetcher.data.ok) {
      onDone();
      return;
    }
    const form = formRef.current;
    const invalid = form?.querySelector<HTMLElement>('[aria-invalid="true"]');
    const target =
      invalid?.getAttribute("role") === "radiogroup"
        ? invalid.querySelector<HTMLElement>("input")
        : (invalid ??
          form?.querySelector<HTMLElement>(
            '[data-place-picker]:has([data-picker-error]) input:not([type="hidden"])',
          ));
    target?.focus();
  }, [fetcher.state, fetcher.data, onDone]);

  const unshown = issues.filter((i) => !isFieldIssue(i.path));
  const general =
    result && !result.ok && (issues.length === 0 || unshown.length > 0)
      ? (unshown[0]?.message ?? result.error)
      : undefined;

  return (
    <fetcher.Form method="post" ref={formRef} className="space-y-1" noValidate data-period-form>
      <ChoiceGroup<CarePeriodType | "">
        name={FIELD.type}
        label="Where is care now?"
        options={TYPE_OPTIONS}
        value={type}
        onChange={setType}
        error={issueFor(issues, FIELD.type)}
      />

      <Field
        label={type === "other" ? "Label" : "Label (optional)"}
        kind="input"
        error={issueFor(issues, FIELD.label)}
      >
        {(control) => (
          <input
            {...control}
            name={FIELD.label}
            defaultValue={period?.label ?? undefined}
            maxLength={CARE_PERIOD_LIMITS.label}
            placeholder={type === "other" ? "e.g. Daughter's house" : "e.g. Cardiac unit"}
            autoComplete="off"
          />
        )}
      </Field>

      <PlacePickerField
        providers={providers}
        initialId={start.placeProviderId}
        error={issueFor(issues, FIELD.placeProviderId)}
      />

      <Field label="Room or bed (optional)" kind="input" error={issueFor(issues, FIELD.placeDetail)}>
        {(control) => (
          <input
            {...control}
            name={FIELD.placeDetail}
            defaultValue={period?.placeDetail ?? undefined}
            maxLength={CARE_PERIOD_LIMITS.placeDetail}
            placeholder="e.g. Room 412, bed B"
            autoComplete="off"
          />
        )}
      </Field>

      <div data-period-start>
        <DateTimeField
          name={FIELD.startedAt}
          label={dateOnly ? "Started on" : "Started"}
          granularity={dateOnly ? "day" : "minute"}
          defaultValue={start.startedAt ?? undefined}
          max={max}
          timeZone={timeZone}
          error={issueFor(issues, FIELD.startedAt)}
        />
        <CheckField
          className="mt-2"
          name={FIELD.dateOnly}
          label="Date only (no time)"
          checked={dateOnly}
          onChange={(e) => setDateOnly(e.target.checked)}
        />
        {zoneNote && <p className="text-muted text-sm">{zoneNote}</p>}
      </div>

      {general && (
        <Message tone="error" data-form-error="">
          {general}
        </Message>
      )}

      <FormFooter
        submitLabel={period ? "Save changes" : "Save period"}
        busy={busy}
        cancel={{ label: "Cancel", onCancel }}
      />
    </fetcher.Form>
  );
}
