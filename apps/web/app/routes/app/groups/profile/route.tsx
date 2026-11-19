import type { Route } from "./+types/route";
import type { ShouldRevalidateFunctionArgs } from "react-router";

import { Outlet } from "react-router";
import { canReadRecipient } from "@caretook/data/schema";
import { appUrls } from "~/lib/appUrls";
import { getGroup, useGroup } from "~/lib/group";
import { VIEWER_DETAILS_LINE } from "~/lib/recipientDisplay";
import { sessionContext } from "~/lib/session";
import { loadRecipientProfileRows, useRecipientProfile } from "~/lib/sync/profile";
import { BasicsCard, NoteCard } from "./ProfileCards";
import { ProfileHeader } from "./ProfileHeader";

// Shared by web + native. `…/profile`: the care recipient's profile, for
// every member. Read from the device's copy (live, so it works offline and
// follows other members' edits). Writers edit it in sheets over the page
// (`profile/basics`), online only. Later slices append writers' regions
// (contact, insurance, emergency contacts) after the note.

export function meta({ loaderData }: Route.MetaArgs) {
  return [{ title: loaderData?.title ? `${loaderData.title} · Profile · Caretook` : "Profile · Caretook" }];
}

export async function clientLoader({ params, context }: Route.ClientLoaderArgs) {
  const group = getGroup(context);
  const { db } = context.get(sessionContext);
  const rows = await loadRecipientProfileRows(db, params.groupId);
  return { rows, title: group.recipient?.displayName ?? group.displayName };
}

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

  return (
    <main className="mx-auto max-w-2xl space-y-4 px-4 py-5" data-profile="">
      {!profile ? (
        <>
          <h1 className="text-lg font-semibold">{group.displayName}</h1>
          <p className="text-base-content/70 text-sm">This care group has no care recipient yet.</p>
        </>
      ) : (
        <>
          <ProfileHeader profile={profile} />
          <BasicsCard profile={profile} />
          <NoteCard profile={profile} canEdit={group.canWrite} />
          {!canReadRecipient(group.role, "details") && (
            <p className="text-base-content/70 text-sm" data-viewer-more="">
              {VIEWER_DETAILS_LINE}
            </p>
          )}
        </>
      )}

      {/* The edit sheets render here, over the profile. */}
      <Outlet />
    </main>
  );
}
