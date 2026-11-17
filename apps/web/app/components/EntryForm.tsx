import type { TimelineEntryKind, UnitChoices, VitalType } from "@caretook/data/schema";
import type { ActionResult, FieldIssue } from "~/lib/api";
import type { TimelineEntry } from "~/lib/rpc";

import { useEffect, useId, useRef, useState } from "react";
import { useFetcher } from "react-router";
import { isKnownReading, isSymptomDetails, isVitalDetails, TIMELINE_LIMITS } from "@caretook/data/schema";
import { DateTimeField } from "./DateTimeField";
import { VitalReadingsFields } from "./VitalReadingsFields";
import { VitalTypeMenu } from "./VitalTypeMenu";

const KINDS: { value: Exclude<TimelineEntryKind, "vital">; label: string }[] = [
  { value: "note", label: "Note" },
  { value: "symptom", label: "Symptom" },
  { value: "event", label: "Event" },
];

// Plain-language messages for the fields people most often miss. The
// server's Zod messages ("Too small: expected string…") aren't for users.
const FRIENDLY: Record<string, string> = {
  body: "Write the note.",
  title: "Give it a title.",
  "details.name": "Name the symptom.",
  details: "Name the symptom.",
  occurredAt: "Enter a date and time.",
};

const issueFor = (issues: FieldIssue[], ...paths: string[]) => {
  const issue = issues.find((i) => paths.includes(i.path));
  return issue ? (FRIENDLY[issue.path] ?? issue.message) : undefined;
};

/**
 * Add or edit a timeline entry. Each kind asks for what it requires: a note
 * its text, a symptom its name, an event its title, vitals their readings
 * (picked from the Vitals menu, shown in the user's `units`). Posts to the
 * timeline route's clientAction.
 */
export function EntryForm({
  entry,
  units,
  initialKind = "note",
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
  const fetcher = useFetcher<ActionResult>();
  const formRef = useRef<HTMLFormElement>(null);
  const id = useId();
  const [kind, setKind] = useState<TimelineEntryKind>(entry?.kind ?? initialKind);
  const storedReadings = isVitalDetails(entry?.details) ? entry.details.readings.filter(isKnownReading) : [];
  const [vitalTypes, setVitalTypes] = useState<VitalType[]>(
    entry ? storedReadings.map((r) => r.type) : initialVitalType ? [initialVitalType] : [],
  );
  // Bumped after each new entry is saved, so the reading fields remount
  // empty (and drop their warnings). Adjusted during render, not in an effect.
  const [resetKey, setResetKey] = useState(0);
  const [savedResult, setSavedResult] = useState<ActionResult | undefined>(undefined);
  const symptom = isSymptomDetails(entry?.details) ? entry.details : undefined;

  const result = fetcher.state === "idle" ? fetcher.data : undefined;
  if (!entry && result?.ok && result !== savedResult) {
    setSavedResult(result);
    setResetKey((k) => k + 1);
  }
  const issues = result && !result.ok ? result.issues : [];

  // After a successful save: clear the add form for the next entry, or
  // close the edit form. The ref makes each result count once.
  const handled = useRef<ActionResult | undefined>(undefined);
  useEffect(() => {
    if (fetcher.state !== "idle" || !fetcher.data?.ok || handled.current === fetcher.data) return;
    handled.current = fetcher.data;
    if (!entry) formRef.current?.reset();
    onDone?.();
  }, [fetcher.state, fetcher.data, entry, onDone]);

  const busy = fetcher.state !== "idle";
  const bodyIssue = issueFor(issues, "body");
  const titleIssue = issueFor(issues, "title");
  const nameIssue = issueFor(issues, "details.name", "details");

  return (
    <fetcher.Form method="post" ref={formRef} className="space-y-1" noValidate>
      <input type="hidden" name="intent" value={entry ? "update" : "create"} />
      <input type="hidden" name="units" value={JSON.stringify(units)} />
      {entry && <input type="hidden" name="id" value={entry.id} />}

      {entry ? (
        <input type="hidden" name="kind" value={entry.kind} />
      ) : (
        <fieldset className="fieldset">
          <legend className="fieldset-legend">What happened?</legend>
          <div className="join">
            {KINDS.map((k) => (
              <input
                key={k.value}
                type="radio"
                name="kind"
                value={k.value}
                aria-label={k.label}
                checked={kind === k.value}
                onChange={() => setKind(k.value)}
                className="join-item btn btn-sm"
              />
            ))}
            <VitalTypeMenu
              className={`join-item btn btn-sm ${kind === "vital" ? "btn-neutral" : ""}`}
              onSelect={(type) => {
                setKind("vital");
                setVitalTypes([type]);
              }}
            >
              Vitals <span aria-hidden="true">▾</span>
            </VitalTypeMenu>
          </div>
          {kind === "vital" && <input type="hidden" name="kind" value="vital" />}
        </fieldset>
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
        <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
          <fieldset className="fieldset">
            <label className="fieldset-legend" htmlFor={`${id}-name`}>
              Symptom
            </label>
            <input
              id={`${id}-name`}
              name="symptomName"
              className="input w-full"
              maxLength={TIMELINE_LIMITS.symptomName}
              defaultValue={symptom?.name ?? ""}
              placeholder="e.g. Knee pain"
              aria-invalid={!!nameIssue}
              aria-describedby={nameIssue ? `${id}-name-error` : undefined}
            />
            {nameIssue && (
              <p id={`${id}-name-error`} className="text-error text-sm">
                {nameIssue}
              </p>
            )}
          </fieldset>
          <fieldset className="fieldset">
            <label className="fieldset-legend" htmlFor={`${id}-severity`}>
              Severity
            </label>
            <select
              id={`${id}-severity`}
              name="severity"
              className="select"
              defaultValue={symptom?.severity ?? ""}
            >
              <option value="">Not rated</option>
              {Array.from({ length: TIMELINE_LIMITS.severityMax + 1 }, (_, n) => (
                <option key={n} value={n}>
                  {n} / {TIMELINE_LIMITS.severityMax}
                </option>
              ))}
            </select>
          </fieldset>
        </div>
      )}

      {(kind === "note" || kind === "event") && (
        <fieldset className="fieldset">
          <label className="fieldset-legend" htmlFor={`${id}-title`}>
            {kind === "event" ? "Title" : "Title (optional)"}
          </label>
          <input
            id={`${id}-title`}
            name="title"
            className="input w-full"
            maxLength={TIMELINE_LIMITS.title}
            defaultValue={entry?.title ?? ""}
            placeholder={kind === "event" ? "e.g. Physical therapy" : ""}
            aria-invalid={!!titleIssue}
            aria-describedby={titleIssue ? `${id}-title-error` : undefined}
          />
          {titleIssue && (
            <p id={`${id}-title-error`} className="text-error text-sm">
              {titleIssue}
            </p>
          )}
        </fieldset>
      )}

      <fieldset className="fieldset">
        <label className="fieldset-legend" htmlFor={`${id}-body`}>
          {kind === "note" ? "Note" : "Notes (optional)"}
        </label>
        <textarea
          id={`${id}-body`}
          name="body"
          className="textarea w-full"
          rows={3}
          maxLength={TIMELINE_LIMITS.body}
          defaultValue={entry?.body ?? ""}
          aria-invalid={!!bodyIssue}
          aria-describedby={bodyIssue ? `${id}-body-error` : undefined}
        />
        {bodyIssue && (
          <p id={`${id}-body-error`} className="text-error text-sm">
            {bodyIssue}
          </p>
        )}
      </fieldset>

      <DateTimeField name="occurredAt" label="When" defaultValue={entry?.occurredAt} />
      {issueFor(issues, "occurredAt") && (
        <p className="text-error text-sm">{issueFor(issues, "occurredAt")}</p>
      )}

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
    </fetcher.Form>
  );
}
