import type { ReactNode } from "react";
import type { LocalMedication } from "~/lib/sync/medications";

import { localTimeZone } from "~/lib/format";
import { formatDate, scheduleText, scheduleZoneNote, stoppedText } from "~/lib/medicationDisplay";

function Row({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-0.5 px-3 py-2.5" data-detail={id}>
      <dt className="text-base-content/70 w-28 shrink-0 text-sm">{label}</dt>
      <dd className="min-w-0 flex-1 wrap-break-word whitespace-pre-line">{children}</dd>
    </div>
  );
}

const LIST = "rounded-box border-base-300 bg-base-100 divide-base-200 divide-y overflow-hidden border";

/**
 * What the medication is and how it's taken (schedule, dose, directions,
 * reason, dates), and how and why it stopped. Only what's set is shown.
 */
export function MedicationDetails({
  medication,
  recipientTimeZone,
}: {
  medication: LocalMedication;
  recipientTimeZone: string | null;
}) {
  const zoneNote = scheduleZoneNote(recipientTimeZone, localTimeZone());
  const stopped = stoppedText(medication);

  return (
    <>
      {stopped && (
        <div role="note" className="alert alert-soft" data-medication-stopped>
          <span>
            {stopped}
            {medication.stopNote && <span className="block text-sm">{medication.stopNote}</span>}
          </span>
        </div>
      )}

      <section aria-labelledby="medication-details-heading" className="space-y-2">
        <h2 id="medication-details-heading" className="sr-only">
          Details
        </h2>
        <dl className={LIST} data-medication-details>
          <Row id="schedule" label="Schedule">
            {scheduleText(medication.schedule)}
            {zoneNote && <span className="text-base-content/70 block text-sm">{zoneNote}</span>}
          </Row>
          {medication.dose && (
            <Row id="dose" label="Dose">
              {medication.dose}
            </Row>
          )}
          {medication.directions && (
            <Row id="directions" label="Directions">
              {medication.directions}
            </Row>
          )}
          {medication.reason && (
            <Row id="reason" label="Reason">
              {medication.reason}
            </Row>
          )}
          {medication.startedOn && (
            <Row id="started" label="Started">
              {formatDate(medication.startedOn)}
            </Row>
          )}
        </dl>
      </section>
    </>
  );
}

/** The refill details: last filled, quantity, refills left, Rx number (only what's set). */
export function MedicationRefills({ medication }: { medication: LocalMedication }) {
  const refills = [
    ["last-filled", "Last filled", medication.lastFilledOn ? formatDate(medication.lastFilledOn) : null],
    ["quantity", "Quantity", medication.quantity],
    ["refills-left", "Refills left", medication.refillsLeft === null ? null : String(medication.refillsLeft)],
    ["rx-number", "Rx number", medication.rxNumber],
  ].filter((row): row is [string, string, string] => !!row[2]);
  return (
    <section aria-labelledby="medication-refills-heading" className="space-y-2" data-medication-refills>
      <h2 id="medication-refills-heading" className="font-semibold">
        Refills
      </h2>
      {refills.length === 0 ? (
        <p className="text-base-content/70 text-sm">No refill details yet.</p>
      ) : (
        <dl className={LIST}>
          {refills.map(([id, label, value]) => (
            <Row key={id} id={id} label={label}>
              {value}
            </Row>
          ))}
        </dl>
      )}
    </section>
  );
}
