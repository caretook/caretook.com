import type { LocalMedication } from "~/lib/medications/medications.sync";

import { Link } from "react-router";
import { LINK, TITLE_SUB } from "~/components/ui";
import { appUrls } from "~/lib/app-shell/appUrls";
import { medicationTitle } from "~/lib/medications/medicationDisplay";
import { useMedicationLinkState } from "~/lib/medications/medicationOrigin";

/**
 * A condition's current medications (conditions slice 4): the live ones the
 * medication form says are for it, each a link to its page. Left out when
 * there are none.
 */
export function ConditionMedications({
  groupId,
  medications,
}: {
  groupId: string;
  medications: readonly LocalMedication[];
}) {
  const linkState = useMedicationLinkState();
  if (!medications.length) return null;
  return (
    <section aria-labelledby="condition-medications-heading" data-condition-medications>
      <h3 id="condition-medications-heading" className={`${TITLE_SUB} text-muted`}>
        Medications for it
      </h3>
      <ul className="mt-1 space-y-1">
        {medications.map((m) => (
          <li key={m.id}>
            <Link
              to={appUrls.medication(groupId, m.id)}
              state={linkState}
              className={`${LINK} font-medium`}
              data-condition-medication={m.id}
            >
              {medicationTitle(m)}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
