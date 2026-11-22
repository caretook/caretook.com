import type { ReactNode } from "react";
import type { SchedulePass } from "~/lib/medications/medicationDisplay";
import type { LocalMedication } from "~/lib/medications/medications.sync";
import type { LocalCondition } from "~/lib/profiles/conditions.sync";
import type { ProviderResult } from "./loadSearch";

import { ContactDetails } from "~/components/providers";
import { Button, Sheet } from "~/components/ui";
import { medicationSummaryLine, medicationTitle, STATUS_LABELS } from "~/lib/medications/medicationDisplay";
import { CONDITION_STATUS_LABELS, sinceDate } from "~/lib/profiles/conditions";
import { contactDetails } from "~/lib/providers/contactActions";
import { PROVIDER_TYPE_META } from "~/lib/providers/providerDirectory";

/** A provider, medication or condition result an easy role opened. */
export type EasyOpened =
  | { type: "provider"; provider: ProviderResult }
  | { type: "medication"; medication: LocalMedication }
  | { type: "condition"; condition: LocalCondition };

/** One fact: a label over its value. */
function Fact({ label, line, children }: { label: string; line: string; children: ReactNode }) {
  return (
    <div data-easy-fact={line}>
      <dt className="text-base-content/70 text-sm">{label}</dt>
      <dd className="font-medium break-words whitespace-pre-line">{children}</dd>
    </div>
  );
}

function ProviderFacts({ provider }: { provider: ProviderResult }) {
  const role = [PROVIDER_TYPE_META[provider.type].label, provider.specialty, provider.practiceName]
    .filter(Boolean)
    .join(" · ");
  const details = contactDetails(provider);
  return (
    <>
      <dl className="space-y-3">
        <Fact label="Who" line="role">
          {role}
          {provider.status === "past" && " (past)"}
        </Fact>
      </dl>
      {details.length > 0 && <ContactDetails details={details} />}
    </>
  );
}

function MedicationFacts({
  medication,
  passes,
}: {
  medication: LocalMedication;
  passes: readonly SchedulePass[];
}) {
  const summary = medicationSummaryLine(medication, passes);
  return (
    <dl className="space-y-3">
      {summary && (
        <Fact label="Dose and schedule" line="schedule">
          {summary}
        </Fact>
      )}
      {medication.status !== "current" && (
        <Fact label="Status" line="status">
          {STATUS_LABELS[medication.status]}
        </Fact>
      )}
    </dl>
  );
}

function ConditionFacts({ condition }: { condition: LocalCondition }) {
  const since = sinceDate(condition);
  return (
    <dl className="space-y-3">
      <Fact label="Status" line="status">
        {CONDITION_STATUS_LABELS[condition.status]}
      </Fact>
      {since && (
        <Fact label="Since" line="since">
          {since}
        </Fact>
      )}
      {condition.note && (
        <Fact label="Note" line="note">
          {condition.note}
        </Fact>
      )}
    </dl>
  );
}

const titleOf = (opened: EasyOpened) =>
  opened.type === "provider"
    ? opened.provider.name
    : opened.type === "medication"
      ? medicationTitle(opened.medication)
      : opened.condition.name;

/**
 * What an easy role sees when they open a provider, medication or condition
 * from search: a read-only sheet over the search page with its key facts (a
 * provider's role and contact links, to call or get directions; a
 * medication's dose and schedule; a condition's status, since and note), and
 * no way onward into a section they can't use. Done closes it.
 */
export function EasyResultSheet({
  opened,
  passes,
  onClose,
}: {
  opened: EasyOpened;
  /** The group's passes: a medication's schedule reads by pass name. */
  passes: readonly SchedulePass[];
  onClose: () => void;
}) {
  return (
    <Sheet isOpen onOpenChange={(open) => !open && onClose()} title={titleOf(opened)}>
      <div className="space-y-4 pt-2" data-easy-sheet={opened.type}>
        {opened.type === "provider" && <ProviderFacts provider={opened.provider} />}
        {opened.type === "medication" && <MedicationFacts medication={opened.medication} passes={passes} />}
        {opened.type === "condition" && <ConditionFacts condition={opened.condition} />}
        <div className="flex justify-end">
          <Button variant="primary" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
