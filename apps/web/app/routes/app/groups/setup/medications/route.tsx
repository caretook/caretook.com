import type { Route } from "./+types/route";
import type { ShouldRevalidateFunctionArgs } from "react-router";
import type { CreateResult } from "~/lib/core/api";
import type { MedicationRow } from "~/lib/medications/medications.sync";

import { useCallback, useId, useMemo, useState } from "react";
import { MedicationCard, MedicationForm } from "~/components/medications";
import { Card, List, TITLE_SUB } from "~/components/ui";
import { getGroup, useGroup } from "~/lib/app-shell/group";
import { sessionContext } from "~/lib/auth/session";
import { issuesForSlotRows, medicationFromForm } from "~/lib/medications/medicationFormData";
import { loadFormSources, useMedicationFormSources } from "~/lib/medications/medicationFormSources";
import { createMedication, medicationsQuery, toMedications } from "~/lib/medications/medications.sync";
import { checkMedicationConditions, setMedicationConditions } from "~/lib/profiles/medicationConditions.sync";
import { useLiveQuery } from "~/lib/sync";
import { readRows } from "~/lib/timeline/timeline.sync";
import { scheduleZoneNote } from "@caretook/data/schema";

// Shared by web + native. The setup flow's medications step: the medication
// form on the page (its prescriber picker lists the providers just added),
// posting here, written on the device as the list's add sheet writes it
// (offline too), then a fresh form; below it, what's added, live, as the
// list shows each one.

export async function clientLoader({ context }: Route.ClientLoaderArgs) {
  const group = getGroup(context);
  const { db } = context.get(sessionContext);
  const [sources, rows] = await Promise.all([
    loadFormSources(db, group.id),
    readRows<MedicationRow>(db, medicationsQuery(group.id)),
  ]);
  return { ...sources, rows };
}

/** As the add sheet saves: the conditions checked first, then the medication and its links. */
export async function clientAction({ request, context }: Route.ClientActionArgs): Promise<CreateResult> {
  const group = getGroup(context);
  const { db } = context.get(sessionContext);
  const { input, newProviders, slotRows, conditionIds } = medicationFromForm(await request.formData());
  const badConditions = await checkMedicationConditions(db, group.id, conditionIds);
  if (badConditions) return badConditions;
  const result = await createMedication(db, group.id, input, newProviders, { requireType: true });
  if (!result.ok) return { ...result, issues: issuesForSlotRows(result.issues, slotRows) };
  if (conditionIds.length) await setMedicationConditions(db, result.id, conditionIds);
  return { ok: true, id: result.id };
}

/** The list and the form's sources are live, so a save needn't reload them. */
export function shouldRevalidate({ formMethod, defaultShouldRevalidate }: ShouldRevalidateFunctionArgs) {
  if (formMethod) return false;
  return defaultShouldRevalidate;
}

export default function SetupMedications({ loaderData }: Route.ComponentProps) {
  const { id: groupId, recipient } = useGroup();
  const { providers, names, passes, conditions } = useMedicationFormSources(groupId, loaderData);
  const query = medicationsQuery(groupId);
  const rows = useLiveQuery<MedicationRow>(query.sql, query.params, loaderData.rows);
  const medications = useMemo(() => toMedications(rows), [rows]);
  const zoneNote = scheduleZoneNote(
    recipient?.timeZone ?? null,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
  );
  // Each save starts a new, empty form.
  const [formKey, setFormKey] = useState(0);
  const added = useCallback(() => setFormKey((k) => k + 1), []);
  const addedId = useId();
  return (
    <>
      <Card title="Add a medication">
        <MedicationForm
          key={formKey}
          providers={providers}
          passes={passes}
          names={names}
          conditions={conditions}
          zoneNote={zoneNote}
          onDone={added}
        />
      </Card>
      {medications.length > 0 && (
        <section aria-labelledby={addedId} className="space-y-2" data-setup-added="">
          <h2 id={addedId} className={TITLE_SUB}>
            Added
          </h2>
          <List label="Added medications">
            {medications.map((m) => (
              <MedicationCard key={m.id} medication={m} groupId={groupId} stopped={m.status !== "current"} />
            ))}
          </List>
        </section>
      )}
    </>
  );
}
