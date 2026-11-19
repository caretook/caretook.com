import type { Route } from "./+types/route";
import type { ActionResult } from "~/lib/api";

import { Detail, Details, SettingsCard, SettingsPage } from "~/components/settings";
import { formString } from "~/lib/form";
import { getGroup, useGroup } from "~/lib/group";
import { rpc } from "~/lib/rpc";
import { failedSave, loadRecipientProfile } from "../api";
import { GroupNameForm, RecipientForm } from "./DetailsForms";
import {
  formatDateOfBirth,
  groupSettingsAccess,
  NEEDS_CONNECTION,
  parseGroupName,
  parseRecipientProfile,
} from "../groupSettings";

// `…/settings/details`. Shared by web + native. The group's and the
// recipient's names come from the device's local copy (live, so they work
// offline and follow other members' changes); the date of birth comes from
// the API. Renaming and editing the recipient go through the API: online only.

export const meta = () => [{ title: "Details · Group settings · Caretook" }];

export { shouldRevalidate } from "../api";

export async function clientLoader({ request, params, context }: Route.ClientLoaderArgs) {
  getGroup(context);
  return loadRecipientProfile(request, params.groupId);
}

export async function clientAction({ request, params }: Route.ClientActionArgs): Promise<ActionResult> {
  const { groupId } = params;
  const form = await request.formData();
  const intent = formString(form, "intent");
  try {
    if (intent === "renameGroup") {
      const parsed = parseGroupName({ name: formString(form, "name") });
      if (!parsed.ok) return parsed;
      await rpc.careGroup.update({ groupId, ...parsed.data });
      return { ok: true };
    }
    if (intent === "updateRecipient") {
      const parsed = parseRecipientProfile({
        name: formString(form, "name"),
        preferredName: formString(form, "preferredName"),
        dateOfBirth: formString(form, "dateOfBirth"),
      });
      if (!parsed.ok) return parsed;
      await rpc.careGroup.updateRecipient({ groupId, ...parsed.data });
      return { ok: true };
    }
    return { ok: false, error: "Unknown action.", issues: [] };
  } catch (e) {
    return failedSave(e);
  }
}

export default function GroupDetails({ loaderData }: Route.ComponentProps) {
  const { online, recipient } = loaderData;

  // Live from the device: a rename or a changed role shows without a reload.
  const group = useGroup();
  const access = groupSettingsAccess(group.id, group.role);

  return (
    <SettingsPage title="Details" offlineNotice={online ? undefined : NEEDS_CONNECTION}>
      {/* Each part of the page is one <section> card; later parts are appended after the last one. */}
      <SettingsCard id="group-details" title="Care group">
        {online && access.renameGroup ? (
          <GroupNameForm name={group.name} />
        ) : (
          <Details>
            <Detail label="Name" value={group.name} />
          </Details>
        )}
      </SettingsCard>

      <SettingsCard id="care-recipient" title="Care recipient">
        {!group.recipient ? (
          <p className="text-base-content/70 text-sm">This care group has no care recipient yet.</p>
        ) : online && access.editRecipient ? (
          <RecipientForm
            name={group.recipient.name}
            preferredName={group.recipient.preferredName ?? ""}
            dateOfBirth={recipient?.dateOfBirth ?? ""}
          />
        ) : (
          <Details>
            <Detail label="Name" value={group.recipient.name} />
            <Detail label="Preferred name" value={group.recipient.preferredName} />
            <Detail
              label="Date of birth"
              value={recipient?.dateOfBirth ? formatDateOfBirth(recipient.dateOfBirth) : null}
              empty={online ? "Not set" : "Not available offline"}
            />
          </Details>
        )}
      </SettingsCard>
    </SettingsPage>
  );
}
