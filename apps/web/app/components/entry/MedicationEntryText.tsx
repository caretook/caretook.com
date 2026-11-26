import type { ParsedSearch } from "@caretook/data/schema";
import type { TimelineEntry } from "~/lib/core/rpc";

import { highlightRanges } from "@caretook/data/schema";

import { Link } from "react-router";
import { Highlight } from "~/components/ui";
import { appUrls } from "~/lib/app-shell/appUrls";
import { useGroup } from "~/lib/app-shell/group";
import { useMedicationLinkState } from "~/lib/medications/medicationOrigin";
import { entryMedication, medicationLabel } from "~/lib/medications/medicationEntries";

/**
 * A dose's or change's heading: the medication ("Lisinopril 10 mg"), a link
 * to its page above the row's open target (`relative z-10`), then what
 * happened ("Given 1 tablet", "Changed dose 1 tablet → 2 tablets"). A deleted
 * medication is greyed "(removed)" and isn't a link; nor is it for the
 * easy roles.
 */
export function MedicationHeading({
  entry,
  what,
  standalone = false,
  search,
  className = "",
}: {
  entry: TimelineEntry;
  what: string;
  /** `what` is the whole line (a pass's move names no medication). */
  standalone?: boolean;
  /** Mark the medication's name where the search matches it. */
  search?: ParsedSearch;
  className?: string;
}) {
  // The easy roles can't open a medication's page: the name is text.
  const { id: groupId, easyRole } = useGroup();
  // Its page's Back comes back here.
  const linkState = useMedicationLinkState();
  if (standalone)
    return (
      <p className={`font-semibold break-words ${className}`} data-medication-entry data-pass-moved>
        <Highlight text={what} ranges={search ? highlightRanges(what, search) : undefined} />
      </p>
    );
  const medication = entryMedication(entry);
  const label = medicationLabel(medication);
  const shown = <Highlight text={label} ranges={search ? highlightRanges(label, search) : undefined} />;
  return (
    <p className={`font-semibold break-words ${className}`} data-medication-entry>
      {medication && !medication.deletedAt && !easyRole ? (
        <Link
          to={appUrls.medication(groupId, medication.id)}
          state={linkState}
          className="link link-hover relative z-10"
          data-medication={medication.id}
        >
          {shown}
        </Link>
      ) : (
        <span className={medication?.deletedAt ? "text-faint" : undefined}>
          {shown}
          {medication?.deletedAt && " (removed)"}
        </span>
      )}
      <span className="font-normal">: {what}</span>
    </p>
  );
}
