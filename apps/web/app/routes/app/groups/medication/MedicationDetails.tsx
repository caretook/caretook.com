import type { ReactNode } from "react";
import type { SchedulePass } from "~/lib/medications/medicationDisplay";
import type { LocalMedication } from "~/lib/medications/medications.sync";

import { Link } from "react-router";
import { appUrls } from "~/lib/app-shell/appUrls";
import { localTimeZone } from "~/lib/core/format";
import {
  formatDate,
  medicationTypeDetail,
  scheduleText,
  scheduleZoneNote,
  stoppedText,
} from "~/lib/medications/medicationDisplay";
import { PROFILE_SHEET_STATE } from "~/lib/profiles/profileSheetLink";

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
 * What the medication is (its type, or "not set") and how it's taken
 * (schedule, dose, directions, the conditions it's for, reason, dates), and
 * how and why it stopped. Only what's set is shown, but for the type. Each condition opens its sheet over the profile, and
 * closing it comes back here.
 */
export function MedicationDetails({
  groupId,
  medication,
  conditions,
  passes,
  recipientTimeZone,
}: {
  groupId: string;
  medication: LocalMedication;
  /** The live conditions it's for (conditions slice 4), by name. */
  conditions: readonly { id: string; name: string }[];
  /** The group's passes, deleted ones too: the schedule reads by pass name. */
  passes: readonly SchedulePass[];
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
          <Row id="type" label="Type">
            {medicationTypeDetail(medication.type)}
          </Row>
          <Row id="schedule" label="Schedule">
            {scheduleText(medication.schedule, passes, medication.dose)}
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
          {conditions.length > 0 && (
            <Row id="for" label="For">
              {conditions.map((c, i) => (
                <span key={c.id}>
                  {i > 0 && ", "}
                  <Link
                    to={appUrls.condition(groupId, c.id)}
                    state={PROFILE_SHEET_STATE}
                    className="link"
                    data-medication-condition={c.id}
                  >
                    {c.name}
                  </Link>
                </span>
              ))}
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
