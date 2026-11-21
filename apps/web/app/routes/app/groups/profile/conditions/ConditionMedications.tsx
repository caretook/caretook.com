import type { LocalMedication } from "~/lib/medications/medications.sync";

import { Link } from "react-router";
import { appUrls } from "~/lib/app-shell/appUrls";
import { medicationTitle } from "~/lib/medications/medicationDisplay";

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
  if (!medications.length) return null;
  return (
    <section aria-labelledby="condition-medications-heading" data-condition-medications>
      <h3 id="condition-medications-heading" className="text-base-content/70 text-sm">
        Medications for it
      </h3>
      <ul className="mt-1 space-y-1">
        {medications.map((m) => (
          <li key={m.id}>
            <Link
              to={appUrls.medication(groupId, m.id)}
              className="link font-medium"
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
