import type { Route } from "./+types/route";
import type { ActionResult } from "~/lib/core/api";
import type { SymptomCatalogRow as Row } from "~/lib/timeline/symptomCatalogPage.sync";

import { SettingsCard, SettingsPage } from "~/components/settings";
import { EmptyState, List } from "~/components/ui";
import { getGroup, useGroup } from "~/lib/app-shell/group";
import { sessionContext } from "~/lib/auth/session";
import { formString } from "~/lib/core/form";
import { rpc } from "~/lib/core/rpc";
import {
  splitByArchived,
  symptomCatalogPageQuery,
  useSymptomCatalogPage,
} from "~/lib/timeline/symptomCatalogPage.sync";
import { readRows } from "~/lib/timeline/timeline.sync";
import { failedSave } from "../api";
import { symptomCatalogAccess } from "../groupSettings";
import { SymptomCatalogRow } from "./SymptomCatalogRow";

// `…/settings/symptoms` (symptom-catalog-2 slice 5). Shared by web + native.
// The group's symptom catalog from the device's copy (live, so an archive
// arriving by sync moves its row): the active symptoms A to Z, each with how
// many live entries use it, then the archived ones. A merged symptom (a
// tombstone) isn't listed. Archive and Unarchive are server-set, so they go
// through the API: online only, for writers (`symptomCatalogAccess`).

export const meta = () => [{ title: "Symptoms · Group settings · Caretook" }];

export { shouldRevalidate } from "../api";

export async function clientLoader({ params, context }: Route.ClientLoaderArgs) {
  getGroup(context);
  const { db } = context.get(sessionContext);
  const rows = await readRows<Row>(db, symptomCatalogPageQuery(params.groupId));
  return { rows };
}

export async function clientAction({ request, params }: Route.ClientActionArgs): Promise<ActionResult> {
  const { groupId } = params;
  const form = await request.formData();
  const intent = formString(form, "intent");
  const id = formString(form, "id");
  try {
    if (intent === "archive") await rpc.timeline.symptomTypes.archive({ groupId, id });
    else if (intent === "unarchive") await rpc.timeline.symptomTypes.unarchive({ groupId, id });
    else return { ok: false, error: "Unknown action.", issues: [] };
    return { ok: true };
  } catch (e) {
    return failedSave(e);
  }
}

export default function GroupSymptoms({ loaderData }: Route.ComponentProps) {
  const group = useGroup();
  const rows = useSymptomCatalogPage(group.id, loaderData.rows);
  const { active, archived } = splitByArchived(rows);
  const { archive } = symptomCatalogAccess(group.id, group.role);

  return (
    <SettingsPage title="Symptoms">
      <SettingsCard id="symptoms">
        <p className="text-muted text-sm">
          The symptoms the care group logs, shared by everyone in it. An archived symptom is no longer
          suggested; its entries stay on the timeline.
        </p>
        {active.length ? (
          <List label="The group's symptoms" data-symptom-list="active">
            {active.map((row) => (
              <SymptomCatalogRow key={row.id} row={row} canArchive={archive} />
            ))}
          </List>
        ) : (
          <EmptyState data-symptoms-empty="">
            {archived.length ? "Every symptom is archived." : "No symptoms yet. Log one from the timeline."}
          </EmptyState>
        )}
      </SettingsCard>
      {archived.length > 0 && (
        <SettingsCard id="symptoms-archived" title="Archived">
          <List label="Archived symptoms" data-symptom-list="archived">
            {archived.map((row) => (
              <SymptomCatalogRow key={row.id} row={row} canArchive={archive} />
            ))}
          </List>
        </SettingsCard>
      )}
    </SettingsPage>
  );
}
