import type { TimelineEntryKind, UnitChoices, VitalType } from "@caretook/data/schema";
import type { TimelineEntry } from "~/lib/rpc";

import { useState } from "react";
import { isKnownReading, isSymptomDetails, isVitalDetails, TIMELINE_LIMITS } from "@caretook/data/schema";
import { Field } from "~/components/ui";
import { DateTimeField } from "~/components/ui/date";
import { EntryKindPicker } from "./EntryKindPicker";
import { issueFor } from "./formIssues";
import { SymptomFields } from "./SymptomFields";
import { useEntryFormSave } from "./useEntryFormSave";
import { VitalReadingsFields } from "./VitalReadingsFields";

/**
 * Add or edit a symptom or vitals entry (notes and events are written in
 * their own editor): the shell (kind, notes, when, errors, save and cancel)
 * around the kind's own fields: a symptom's name and severity, or vitals'
 * readings in the user's `units`. Posts to the sheet route's clientAction.
 */
export function EntryForm({
  entry,
  units,
  initialKind = "symptom",
  initialVitalType,
  onDone,
  onCancel,
}: {
  /** Editing this entry; omit to add a new one. */
  entry?: TimelineEntry;
  units: UnitChoices;
  /** For a new entry: the kind to start with, and for vitals the first reading. */
  initialKind?: TimelineEntryKind;
  initialVitalType?: VitalType;
  onDone?: () => void;
  onCancel?: () => void;
}) {
  const { Form, formRef, resetKey, busy, result, issues } = useEntryFormSave({ adding: !entry, onDone });
  const [kind, setKind] = useState<TimelineEntryKind>(entry?.kind ?? initialKind);
  const storedReadings = isVitalDetails(entry?.details) ? entry.details.readings.filter(isKnownReading) : [];
  const [vitalTypes, setVitalTypes] = useState<VitalType[]>(
    entry ? storedReadings.map((r) => r.type) : initialVitalType ? [initialVitalType] : [],
  );

  return (
    <Form method="post" ref={formRef} className="space-y-1" noValidate>
      <input type="hidden" name="intent" value={entry ? "update" : "create"} />
      <input type="hidden" name="units" value={JSON.stringify(units)} />
      {entry && <input type="hidden" name="id" value={entry.id} />}

      {entry ? (
        <input type="hidden" name="kind" value={entry.kind} />
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
        />
      )}

      {kind === "symptom" && (
        <SymptomFields
          stored={isSymptomDetails(entry?.details) ? entry.details : undefined}
          nameError={issueFor(issues, "details.name", "details")}
        />
      )}

      <Field label="Notes (optional)" error={issueFor(issues, "body")}>
        {(control) => (
          <textarea
            {...control}
            name="body"
            className="textarea w-full"
            rows={3}
            maxLength={TIMELINE_LIMITS.body}
            defaultValue={entry?.body ?? ""}
          />
        )}
      </Field>

      <DateTimeField
        name="occurredAt"
        label="When"
        defaultValue={entry?.occurredAt}
        error={issueFor(issues, "occurredAt")}
      />

      {result && !result.ok && !issues.length && (
        <p role="alert" className="text-error text-sm">
          {result.error}
        </p>
      )}

      <div className="flex gap-2 pt-2">
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? "Saving…" : entry ? "Save changes" : "Add to timeline"}
        </button>
        {onCancel && (
          <button type="button" className="btn btn-ghost" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </Form>
  );
}
