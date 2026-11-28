import type { ReactNode } from "react";
import type { LocalMedication } from "~/lib/medications/medications.sync";
import type { LocalCondition } from "~/lib/profiles/conditions.sync";
import type { ProviderResult, SearchPageData } from "./loadSearch";
import type { EasyOpenedRef } from "./useEasyOpened";

import { ContactDetails } from "~/components/providers";
import { Button, Sheet } from "~/components/ui";
import { CONDITION_STATUS_LABELS, sinceDate } from "~/lib/profiles/conditions";
import { contactDetails } from "~/lib/providers/contactActions";
import { PROVIDER_TYPE_META } from "~/lib/providers/providerDirectory";
import { useEasyOpened } from "./useEasyOpened";
import type { SchedulePass } from "@caretook/data/schema";
import { medicationSummaryLine, medicationTitle, STATUS_LABELS } from "@caretook/data/schema";

/** A provider, medication or condition result an easy role opened. */
export type EasyOpened =
  | { type: "provider"; provider: ProviderResult }
  | { type: "medication"; medication: LocalMedication }
  | { type: "condition"; condition: LocalCondition };

/** One fact: a label over its value. */
function Fact({ label, line, children }: { label: string; line: string; children: ReactNode }) {
  return (
    <div data-easy-fact={line}>
      <dt className="text-muted text-sm">{label}</dt>
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

const GONE_TITLES: Record<EasyOpened["type"], string> = {
  provider: "Provider removed",
  medication: "Medication removed",
  condition: "Condition removed",
};

/**
 * What an easy role sees when they open a provider, medication or condition
 * from search: a read-only sheet over the search page with its key facts (a
 * provider's role and contact links, to call or get directions; a
 * medication's dose and schedule; a condition's status, since and note), and
 * no way onward into a section they can't use. It reads the row live, so
 * another member's edit shows here, and a delete says it's gone. Done closes
 * it.
 */
export function EasyResultSheet({
  openedRef,
  groupId,
  data,
  passes,
  onClose,
}: {
  openedRef: EasyOpenedRef;
  groupId: string;
  /** The page's results: the row until the live read answers. */
  data: SearchPageData;
  /** The group's passes: a medication's schedule reads by pass name. */
  passes: readonly SchedulePass[];
  onClose: () => void;
}) {
  const opened = useEasyOpened(groupId, openedRef, data);
  return (
    <Sheet
      isOpen
      onOpenChange={(open) => !open && onClose()}
      title={opened ? titleOf(opened) : GONE_TITLES[openedRef.type]}
    >
      <div className="space-y-4 pt-2" data-easy-sheet={openedRef.type} data-gone={opened ? undefined : ""}>
        {!opened && <p>This {openedRef.type} was removed from the care group, so there's nothing to show.</p>}
        {opened?.type === "provider" && <ProviderFacts provider={opened.provider} />}
        {opened?.type === "medication" && <MedicationFacts medication={opened.medication} passes={passes} />}
        {opened?.type === "condition" && <ConditionFacts condition={opened.condition} />}
        <div className="flex justify-end">
          <Button variant="primary" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
