import type { ParsedSearch } from "@caretook/data/schema";
import type { TimelineEntry } from "~/lib/rpc";

import { highlightRanges } from "@caretook/data/schema";

import { Link } from "react-router";
import { Highlight } from "~/components/ui";
import { appUrls } from "~/lib/appUrls";
import { useGroup } from "~/lib/group";
import { entryMedication, medicationLabel } from "~/lib/medicationEntries";

/**
 * A dose's or change's heading: the medication ("Lisinopril 10 mg"), a link
 * to its page above the row's open target (`relative z-10`), then what
 * happened ("Given 1 tablet", "Changed dose 1 tablet → 2 tablets"). A deleted
 * medication is greyed "(removed)" and isn't a link.
 */
export function MedicationHeading({
  entry,
  what,
  search,
  className = "",
}: {
  entry: TimelineEntry;
  what: string;
  /** Mark the medication's name where the search matches it. */
  search?: ParsedSearch;
  className?: string;
}) {
  const { id: groupId } = useGroup();
  const medication = entryMedication(entry);
  const label = medicationLabel(medication);
  const shown = <Highlight text={label} ranges={search ? highlightRanges(label, search) : undefined} />;
  return (
    <p className={`font-semibold break-words ${className}`} data-medication-entry>
      {medication && !medication.deletedAt ? (
        <Link
          to={appUrls.medication(groupId, medication.id)}
          className="link link-hover relative z-10"
          data-medication={medication.id}
        >
          {shown}
        </Link>
      ) : (
        <span className={medication ? "text-base-content/50" : undefined}>
          {shown}
          {medication && " (removed)"}
        </span>
      )}
      <span className="font-normal">: {what}</span>
    </p>
  );
}
