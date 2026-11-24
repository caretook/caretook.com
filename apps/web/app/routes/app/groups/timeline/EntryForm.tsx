import type { TimelineEntryKind, UnitChoices, VitalType } from "@caretook/data/schema";
import type { EntryDraft } from "~/lib/assistant/quickEntryDraft";
import type { TimelineEntry } from "~/lib/core/rpc";

import { useState } from "react";
import {
  DEVICE_FUTURE_SKEW_MS,
  isKnownReading,
  isSymptomDetails,
  isVitalDetails,
  TIMELINE_LIMITS,
} from "@caretook/data/schema";
import { Field, FormFooter, Message } from "~/components/ui";
import { DateTimeField } from "~/components/ui/date";
import { EntryKindPicker } from "./EntryKindPicker";
import { FeelingFields } from "./FeelingFields";
import { issueFor } from "./formIssues";
import { SymptomFields } from "./SymptomFields";
import { useEntryFormSave } from "./useEntryFormSave";
import { VitalReadingsFields } from "./VitalReadingsFields";

/** The latest time a symptom or vital can be given: now plus the device's skew, or a later stored time. */
const latestTime = (stored?: string) => {
  const limit = Date.now() + DEVICE_FUTURE_SKEW_MS;
  const at = stored ? new Date(stored).getTime() : 0;
  return new Date(Math.max(limit, at)).toISOString();
};

/**
 * Add or edit a symptom or vitals entry (notes and events are written in
 * their own editor): the shell (kind, notes, when, errors, save and cancel)
 * around the kind's own fields: a symptom's name and severity, or vitals'
 * readings in the user's `units`. Posts to the sheet route's clientAction.
 *
 * `easy` is easy mode's variant (a tile's sheet): no kind picker or
 * notes, a symptom is the 0–10 feelings scale (`FeelingFields`), and vitals
 * are the fields for the one type it opened with.
 */
export function EntryForm({
  entry,
  units,
  initialKind = "symptom",
  initialVitalType,
  initialAt,
  draft,
  easy,
  onDone,
  onCancel,
}: {
  /** Editing this entry; omit to add a new one. */
  entry?: TimelineEntry;
  units: UnitChoices;
  /** For a new entry: the kind to start with, and for vitals the first reading. */
  initialKind?: TimelineEntryKind;
  initialVitalType?: VitalType;
  /** For a new entry: when it starts at (an ISO time, a past day's +), unless the draft has a time; now when left out. */
  initialAt?: string | null;
  /** For a new entry: what to fill it in with (quick entry's Edit). */
  draft?: EntryDraft | null;
  /** Easy mode's variant, with the feelings scale's question ("How she feels"). */
  easy?: { feelLabel: string } | null;
  onDone?: () => void;
  onCancel?: () => void;
}) {
  const { Form, formRef, resetKey, busy, result, issues } = useEntryFormSave({ adding: !entry, onDone });
  // Editing fills the form from the entry; a draft fills a new one the same way.
  const filled = entry ?? draft ?? undefined;
  const [kind, setKind] = useState<TimelineEntryKind>(filled?.kind ?? initialKind);
  // Symptoms and vitals can't be in the future: the picker stops at now
  // (with the device's few minutes of skew), or at the stored time if later.
  const [latest] = useState(() => latestTime(entry?.occurredAt));
  const storedReadings = isVitalDetails(filled?.details)
    ? filled.details.readings.filter(isKnownReading)
    : [];
  const [vitalTypes, setVitalTypes] = useState<VitalType[]>(
    filled ? storedReadings.map((r) => r.type) : initialVitalType ? [initialVitalType] : [],
  );

  return (
    <Form method="post" ref={formRef} className="space-y-1" noValidate>
      <input type="hidden" name="intent" value={entry ? "update" : "create"} />
      <input type="hidden" name="units" value={JSON.stringify(units)} />
      {entry && <input type="hidden" name="id" value={entry.id} />}

      {entry || easy ? (
        <input type="hidden" name="kind" value={entry?.kind ?? kind} />
      ) : (
        <EntryKindPicker
          kind={kind}
          onSymptom={() => setKind("symptom")}
          onVital={(type) => {
            setKind("vital");
            setVitalTypes([type]);
          }}
        />
      )}

      {kind === "vital" && (
        <VitalReadingsFields
          key={resetKey}
          types={vitalTypes}
          onChange={setVitalTypes}
          initial={storedReadings}
          units={units}
          issues={issues}
          fixed={!!easy}
        />
      )}

      {kind === "symptom" && easy && (
        <FeelingFields
          label={easy.feelLabel}
          stored={isSymptomDetails(filled?.details) ? filled.details : undefined}
          nameError={issueFor(issues, "details.name", "details")}
          severityError={issueFor(issues, "details.severity")}
        />
      )}

      {kind === "symptom" && !easy && (
        <SymptomFields
          stored={isSymptomDetails(filled?.details) ? filled.details : undefined}
          nameError={issueFor(issues, "details.name", "details")}
        />
      )}

      {!easy && (
        <Field label="Notes (optional)" kind="textarea" error={issueFor(issues, "body")}>
          {(control) => (
            <textarea
              {...control}
              name="body"
              rows={3}
              maxLength={TIMELINE_LIMITS.body}
              defaultValue={filled?.body ?? ""}
            />
          )}
        </Field>
      )}

      <DateTimeField
        name="occurredAt"
        label="When"
        defaultValue={filled?.occurredAt ?? initialAt ?? undefined}
        max={latest}
        error={issueFor(issues, "occurredAt")}
      />

      {result && !result.ok && !issues.length && <Message tone="error">{result.error}</Message>}

      <FormFooter
        submitLabel={entry ? "Save changes" : "Add to timeline"}
        busy={busy}
        busyLabel="Saving…"
        size={easy ? "lg" : "md"}
        cancel={onCancel && { label: "Cancel", onCancel }}
      />
    </Form>
  );
}
