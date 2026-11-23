import { Page, PageHeader, Section } from "~/components/ui";
import type { Route } from "./+types/route";
import type { ShouldRevalidateFunctionArgs } from "react-router";
import type { ActionResult } from "~/lib/core/api";

import { Outlet } from "react-router";
import type { RecipientDetailsRow } from "~/lib/profiles/recipientDetails";
import type { MemberDetailRow } from "~/lib/care-groups/members.sync";

import { canEditRecipient, canManageEmergencyContacts, canReadRecipient } from "@caretook/data/schema";
import { useMemo } from "react";
import { appUrls } from "~/lib/app-shell/appUrls";
import { getGroup, useGroup } from "~/lib/app-shell/group";
import { loadSettings } from "~/lib/app-shell/me";
import { VIEWER_DETAILS_LINE } from "~/lib/profiles/recipientDisplay";
import { sessionContext } from "~/lib/auth/session";
import { useLiveQuery } from "~/lib/sync";
import { loadMemberDetailRows, memberDetailsQuery } from "~/lib/care-groups/members.sync";
import { loadRecipientProfileRows, useRecipientProfile } from "~/lib/profiles/profile.sync";
import { loadRecipientDetailsRows, useRecipientDetails } from "~/lib/profiles/recipientDetails.sync";
import { loadRecentReadingRows, useVitalAverages } from "~/lib/profiles/vitalAverages.sync";
import { loadConditions, setNoKnownConditions, useConditions } from "~/lib/profiles/conditions.sync";
import { conditionActionFromForm } from "./conditions/conditionActions";
import { ConditionsSection } from "./ConditionsSection";
import { ContactSection, InsuranceSection } from "./DetailsSections";
import { EmergencySection } from "./EmergencySection";
import { BasicsSection, NoteSection } from "./ProfileSections";
import { ProfileHeader } from "./ProfileHeader";
import { VitalAveragesSection } from "./VitalAveragesSection";

// Shared by web + native. `…/profile`: the care recipient's profile, for
// every member, in bands (`Page bands`: the header, then each part a
// `Section`). Read from the device's copy (live, so it works offline and
// follows other members' edits). Writers edit it in sheets over the page
// (`profile/basics`, `profile/contact`, `profile/insurance`), online only.
// Writers also see the recipient's Contact and Insurance (slice 3) and the
// emergency list (slice 5; owners and admins edit it in `profile/emergency`).

export function meta({ loaderData }: Route.MetaArgs) {
  return [{ title: loaderData?.title ? `${loaderData.title} · Profile · Caretook` : "Profile · Caretook" }];
}

export async function clientLoader({ request, params, context }: Route.ClientLoaderArgs) {
  const group = getGroup(context);
  const { db } = context.get(sessionContext);
  const [rows, { units }] = await Promise.all([
    loadRecipientProfileRows(db, params.groupId),
    loadSettings(request, db.userId),
  ]);
  // Recent vital averages: the windows are days in the recipient's zone.
  const readingRows = await loadRecentReadingRows(db, params.groupId, rows[0]?.time_zone ?? null);
  // The conditions card (every role).
  const conditionRows = await loadConditions(db, params.groupId);
  // Writers' details: only owners', admins' and caretakers' devices have them.
  const detailsRows = canReadRecipient(group.role, "details")
    ? await loadRecipientDetailsRows(db, params.groupId)
    : NO_DETAILS;
  // Members' emergency places and shared phones, for the emergency list.
  const memberRows = canReadRecipient(group.role, "details")
    ? await loadMemberDetailRows(db, params.groupId)
    : NO_MEMBERS;
  return {
    rows,
    readingRows,
    units,
    detailsRows,
    memberRows,
    conditionRows,
    title: group.recipient?.displayName ?? group.displayName,
  };
}

/** The conditions card's "No known conditions" (writers; a local write, so it works offline). */
export async function clientAction({ request, context }: Route.ClientActionArgs): Promise<ActionResult> {
  const group = getGroup(context);
  const { db } = context.get(sessionContext);
  const action = conditionActionFromForm(await request.formData());
  if (action?.intent !== "noKnownConditions") return { ok: false, error: "Nothing to do", issues: [] };
  return setNoKnownConditions(db, group.id, action.on);
}

/** A viewer's details rows: none (a module constant, so the live query's `initial` keeps its identity). */
const NO_DETAILS: RecipientDetailsRow[] = [];
const NO_MEMBERS: MemberDetailRow[] = [];

/**
 * The live query follows every change, so opening or closing a sheet over
 * the page, or a save in one, doesn't load it again.
 */
export function shouldRevalidate({
  formMethod,
  currentUrl,
  nextUrl,
  nextParams,
  defaultShouldRevalidate,
}: ShouldRevalidateFunctionArgs) {
  if (formMethod) return false;
  const base = nextParams.groupId ? appUrls.profile(nextParams.groupId) : null;
  const under = (path: string) => !!base && (path === base || path.startsWith(`${base}/`));
  if (under(currentUrl.pathname) && under(nextUrl.pathname)) return false;
  return defaultShouldRevalidate;
}

export default function Profile({ loaderData, params }: Route.ComponentProps) {
  const group = useGroup();
  const profile = useRecipientProfile(params.groupId, loaderData.rows);
  const details = useRecipientDetails(params.groupId, loaderData.detailsRows);
  // Live: a member demoted to viewer loses the writers' cards as the role syncs.
  const readsDetails = canReadRecipient(group.role, "details");
  const editsDetails = canEditRecipient(group.role, "details");
  const membersQuery = useMemo(() => memberDetailsQuery(params.groupId), [params.groupId]);
  const members = useLiveQuery<MemberDetailRow>(membersQuery.sql, membersQuery.params, loaderData.memberRows);
  const conditions = useConditions(params.groupId, loaderData.conditionRows);
  const averages = useVitalAverages(
    params.groupId,
    profile?.timeZone ?? null,
    loaderData.units,
    loaderData.readingRows,
  );

  return (
    <Page bands data-profile="">
      {!profile ? (
        <Section>
          <PageHeader title={group.displayName} description="This care group has no care recipient yet." />
        </Section>
      ) : (
        <>
          <Section>
            <ProfileHeader profile={profile} />
          </Section>
          <BasicsSection profile={profile} />
          <ConditionsSection groupId={group.id} state={conditions.state} canWrite={group.canWrite} />
          <NoteSection profile={profile} canEdit={group.canWrite} />
          {averages && <VitalAveragesSection rows={averages} />}
          {readsDetails ? (
            <>
              <ContactSection
                groupId={group.id}
                name={profile.displayName}
                details={details}
                canEdit={editsDetails}
              />
              <InsuranceSection groupId={group.id} details={details} canEdit={editsDetails} />
              <EmergencySection
                groupId={group.id}
                members={members}
                outside={details.outsideContacts}
                canManage={canManageEmergencyContacts(group.role)}
              />
            </>
          ) : (
            <Section>
              <p className="text-muted text-sm" data-viewer-more="">
                {VIEWER_DETAILS_LINE}
              </p>
            </Section>
          )}
        </>
      )}

      {/* The edit sheets render here, over the profile. */}
      <Outlet />
    </Page>
  );
}
