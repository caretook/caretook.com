import type { RecipientProfile } from "~/lib/profiles/profile.sync";

import { Pencil, Printer } from "lucide-react";
import { Link } from "react-router";
import { canEditRecipient, canReadRecipient } from "@caretook/data/schema";
import { UserAvatar } from "~/components/ui";
import { appUrls } from "~/lib/app-shell/appUrls";
import { useGroup } from "~/lib/app-shell/group";
import { ageText, birthdayText, PROFILE_NEEDS_CONNECTION } from "~/lib/profiles/recipientDisplay";
import { PROFILE_SHEET_STATE, useOnline } from "./profileSheet";

/**
 * The profile's heading: the name everyone uses, the full name when a
 * preferred one is set, the birthday and age (on the recipient's own day),
 * and, for writers, the emergency sheet's Print link (it opens offline too)
 * and Edit (online only; offline it says why it's disabled).
 */
export function ProfileHeader({ profile }: { profile: RecipientProfile }) {
  const group = useGroup();
  const age = ageText(profile.dateOfBirth, profile.timeZone, new Date());
  const born = profile.dateOfBirth ? birthdayText(profile.dateOfBirth) : null;
  return (
    <header className="flex items-start justify-between gap-3" data-profile-header="">
      <div className="flex min-w-0 items-center gap-3">
        <UserAvatar name={profile.displayName} size="lg" />
        <div className="min-w-0">
          <h1 className="text-xl font-semibold">{profile.displayName}</h1>
          {profile.preferredName && profile.name !== profile.preferredName && (
            <p className="text-base-content/70 text-sm" data-full-name="">
              {profile.name}
            </p>
          )}
          {(born || age) && (
            <p className="text-sm" data-birthday="">
              {[born && `Born ${born}`, age].filter(Boolean).join(" · ")}
            </p>
          )}
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap items-start justify-end gap-2">
        {canReadRecipient(group.role, "details") && <PrintLink groupId={group.id} />}
        {canEditRecipient(group.role, "basics") && <EditBasics groupId={group.id} />}
      </div>
    </header>
  );
}

function EditBasics({ groupId }: { groupId: string }) {
  const online = useOnline();
  if (!online)
    return (
      <div className="flex shrink-0 flex-col items-end gap-1 text-right">
        <button
          type="button"
          className="btn btn-sm"
          disabled
          aria-label="Edit profile"
          aria-describedby="profile-edit-offline"
          data-edit-basics=""
        >
          <Pencil className="size-4" aria-hidden="true" />
          Edit
        </button>
        <p
          id="profile-edit-offline"
          className="text-base-content/70 max-w-40 text-xs"
          data-needs-connection=""
        >
          {PROFILE_NEEDS_CONNECTION}
        </p>
      </div>
    );
  return (
    <Link
      to={appUrls.profile(groupId, "basics")}
      state={PROFILE_SHEET_STATE}
      prefetch="render"
      preventScrollReset
      className="btn btn-sm shrink-0"
      aria-label="Edit profile"
      data-edit-basics=""
    >
      <Pencil className="size-4" aria-hidden="true" />
      Edit
    </Link>
  );
}

/** The emergency sheet (writers only: their devices have the details it prints). */
function PrintLink({ groupId }: { groupId: string }) {
  return (
    <Link
      to={appUrls.profilePrint(groupId)}
      prefetch="render"
      className="btn btn-sm"
      aria-label="Print emergency sheet"
      data-print-link=""
    >
      <Printer className="size-4" aria-hidden="true" />
      Print
    </Link>
  );
}
