import type { Route } from "./+types/route";
import type { ActionResult } from "~/lib/api";

import { SIMPLE_TILE_COUNT } from "@caretook/data/schema";
import { UserRound } from "lucide-react";
import { Link } from "react-router";
import { Detail, Details, SettingsCard, SettingsPage } from "~/components/settings";
import { appUrls } from "~/lib/appUrls";
import { formString } from "~/lib/form";
import { getGroup, useGroup } from "~/lib/group";
import { rpc } from "~/lib/rpc";
import { failedSave, loadRecipientProfile } from "../api";
import { GroupNameForm, RecipientTimeZoneForm } from "./DetailsForms";
import { SimpleTilesCard } from "./SimpleTilesCard";
import {
  groupSettingsAccess,
  NEEDS_CONNECTION,
  parseGroupName,
  parseRecipientTimeZone,
  parseSimpleTilesChoice,
  tileFieldName,
  timeZoneLabel,
} from "../groupSettings";

// `…/settings/details`. Shared by web + native. The group's name and the
// recipient's time zone come from the device's local copy (live, so they work
// offline and follow other members' changes); saving goes through the API:
// online only. The rest of the recipient is edited on their profile
// (`appUrls.profile`), linked from here. Simple mode's tiles card is the
// group's too (`careGroup.update`'s `simpleTiles`).

export const meta = () => [{ title: "Details · Group settings · Caretook" }];

export { shouldRevalidate } from "../api";

export async function clientLoader({ request, params, context }: Route.ClientLoaderArgs) {
  getGroup(context);
  // Only whether the API answers: the page is read-only without a connection.
  const { online } = await loadRecipientProfile(request, params.groupId);
  return { online };
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
      const parsed = parseRecipientTimeZone({ timeZone: formString(form, "timeZone") });
      if (!parsed.ok) return parsed;
      await rpc.careGroup.updateRecipient({ groupId, ...parsed.data });
      return { ok: true };
    }
    if (intent === "simpleTiles") {
      const parsed = parseSimpleTilesChoice({
        mode: formString(form, "mode"),
        tiles: Array.from({ length: SIMPLE_TILE_COUNT }, (_, i) => formString(form, tileFieldName(i))),
      });
      if (!parsed.ok) return parsed;
      await rpc.careGroup.update({ groupId, ...parsed.data });
      return { ok: true };
    }
    return { ok: false, error: "Unknown action.", issues: [] };
  } catch (e) {
    return failedSave(e);
  }
}

export default function GroupDetails({ loaderData }: Route.ComponentProps) {
  const { online } = loaderData;

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
        ) : (
          <>
            {online && access.editRecipient ? (
              <RecipientTimeZoneForm timeZone={group.recipient.timeZone ?? null} />
            ) : (
              <Details>
                <Detail
                  label="Time zone"
                  value={group.recipient.timeZone ? timeZoneLabel(group.recipient.timeZone) : null}
                />
              </Details>
            )}
            <p className="text-sm" data-profile-note="">
              {group.recipient.displayName}'s name, birthday and details are on{" "}
              <Link
                to={appUrls.profile(group.id)}
                className="link link-primary inline-flex items-center gap-1"
              >
                <UserRound className="size-4" aria-hidden="true" />
                {group.recipient.displayName}'s profile
              </Link>
              .
            </p>
          </>
        )}
      </SettingsCard>

      <SimpleTilesCard
        groupId={group.id}
        displayName={group.recipient?.displayName ?? group.displayName}
        editable={online && access.renameGroup}
      />
    </SettingsPage>
  );
}
