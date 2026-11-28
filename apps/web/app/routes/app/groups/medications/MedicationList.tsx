import type { MedicationStatus, MedicationType, DueDoses, SchedulePass } from "@caretook/data/schema";
import type { MedicationList as Listed } from "~/lib/medications/medicationList";
import type { LocalMedication } from "~/lib/medications/medications.sync";
import type { TagsByRecord } from "~/lib/providers/providerDirectory";

import { EmptyState, List, TITLE_SUB } from "~/components/ui";
import { useGroup } from "~/lib/app-shell/group";
import { sectionAccent } from "~/lib/app-shell/sectionAccents";
import { MedicationListItem } from "./MedicationListItem";
import { MEDICATION_TYPE_LABELS } from "@caretook/data/domain";
import { STATUS_LABELS } from "@caretook/data/schema";

const countLabel = (n: number) => `${n} ${n === 1 ? "medication" : "medications"}`;

/** What each row's Log needs: whether the viewer writes, and today's doses. */
type Logging = { canWrite: boolean; due: DueDoses; dueReady: boolean };

function Rows({
  medications,
  passes,
  label,
  logging,
  recordTags,
}: {
  medications: LocalMedication[];
  passes: readonly SchedulePass[];
  label: string;
  logging: Logging;
  recordTags?: TagsByRecord;
}) {
  return (
    <List label={label}>
      {medications.map((m) => (
        <MedicationListItem
          key={m.id}
          medication={m}
          passes={passes}
          tags={recordTags?.get(m.id)}
          {...logging}
        />
      ))}
    </List>
  );
}

/**
 * The medication list: current medications first, then the completed and
 * discontinued ones below, or why nothing shows. A status line announces how
 * many match after each search or filter. The route composes it (a Today
 * section goes above it later).
 */
export function MedicationList({
  total,
  list,
  passes,
  text,
  status,
  type = null,
  due,
  dueReady,
  tagged = false,
  recordTags,
}: {
  /** Every medication in the group (not deleted), before filtering. */
  total: number;
  list: Listed<LocalMedication>;
  /** The group's passes, deleted ones too: schedules read by pass name. */
  passes: readonly SchedulePass[];
  /** What's typed in the search box. */
  text: string;
  status: MedicationStatus | null;
  type?: MedicationType | null;
  /** Today's doses (`useDueDoses`), for an as-needed Log's warnings. */
  due: DueDoses;
  dueReady: boolean;
  /** Whether a tag filters the list. */
  tagged?: boolean;
  /** Each medication's tags, for the rows' chips. */
  recordTags?: TagsByRecord;
}) {
  const shown = list.current.length + list.stopped.length;
  const what = `${[
    status && STATUS_LABELS[status].toLowerCase(),
    type && MEDICATION_TYPE_LABELS[type].toLowerCase(),
  ]
    .filter(Boolean)
    .join(" ")} medications`.trim();
  const { easyRole, canWrite } = useGroup();
  const logging = { canWrite, due, dueReady };
  const filtered = !!text.trim() || !!status || !!type || tagged;
  const emptyMark = filtered ? undefined : sectionAccent("medications", { easy: easyRole });
  return (
    <>
      <p role="status" className="sr-only">
        {total === 0 ? "" : countLabel(shown)}
      </p>

      <section aria-labelledby="medications-heading" className="space-y-4" data-medication-list>
        <h2 id="medications-heading" className="sr-only">
          {status ? `${STATUS_LABELS[status]} medications` : "All medications"}
        </h2>

        {total === 0 ? (
          <EmptyState {...emptyMark}>No medications yet.</EmptyState>
        ) : (
          shown === 0 && (
            <EmptyState data-empty="">
              {text.trim() ? `No ${what} match “${text.trim()}”.` : `No ${what}.`}
            </EmptyState>
          )
        )}

        {list.current.length > 0 && (
          <Rows
            medications={list.current}
            label="Current medications"
            passes={passes}
            logging={logging}
            recordTags={recordTags}
          />
        )}

        {list.stopped.length > 0 && (
          <section aria-labelledby={status ? undefined : "stopped-heading"} className="space-y-2">
            {!status && (
              <h3 id="stopped-heading" className={`${TITLE_SUB} text-muted`}>
                Completed and discontinued
              </h3>
            )}
            <Rows
              medications={list.stopped}
              passes={passes}
              logging={logging}
              recordTags={recordTags}
              label={
                status ? `${STATUS_LABELS[status]} medications` : "Completed and discontinued medications"
              }
            />
          </section>
        )}
      </section>
    </>
  );
}
