import type { RecipientProfile } from "~/lib/profiles/profile.sync";

import { Pencil, Printer } from "lucide-react";
import { canEditRecipient, canReadRecipient } from "@caretook/data/schema";
import { Button, DetailHeader, UserAvatar } from "~/components/ui";
import { appUrls } from "~/lib/app-shell/appUrls";
import { useGroup } from "~/lib/app-shell/group";
import { ageText, birthdayText, PROFILE_NEEDS_CONNECTION } from "~/lib/profiles/recipientDisplay";
import { PROFILE_SHEET_STATE, useOnline } from "./profileSheet";

/**
 * The profile's heading (`DetailHeader`): the recipient's avatar, the name
 * everyone uses, the full name when a preferred one is set, the birthday and
 * age (on the recipient's own day), and, for writers, the emergency sheet's
 * Print link (it opens offline too) and Edit (online only; offline it says
 * why it's disabled).
 */
export function ProfileHeader({ profile }: { profile: RecipientProfile }) {
  const group = useGroup();
  const age = ageText(profile.dateOfBirth, profile.timeZone, new Date());
  const born = profile.dateOfBirth ? birthdayText(profile.dateOfBirth) : null;
  const fullName = profile.preferredName && profile.name !== profile.preferredName ? profile.name : null;
  const printable = canReadRecipient(group.role, "details");
  const editable = canEditRecipient(group.role, "basics");
  return (
    <DetailHeader
      data-profile-header=""
      media={<UserAvatar name={profile.displayName} size="lg" />}
      title={profile.displayName}
      details={
        (fullName || born || age) && (
          <>
            {fullName && <p data-full-name="">{fullName}</p>}
            {(born || age) && (
              <p className="text-base-content" data-birthday="">
                {[born && `Born ${born}`, age].filter(Boolean).join(" · ")}
              </p>
            )}
          </>
        )
      }
      actions={
        (printable || editable) && (
          <div className="flex flex-wrap items-start justify-end gap-2">
            {printable && <PrintLink groupId={group.id} />}
            {editable && <EditBasics groupId={group.id} />}
          </div>
        )
      }
    />
  );
}

function EditBasics({ groupId }: { groupId: string }) {
  const online = useOnline();
  if (!online)
    return (
      <div className="flex shrink-0 flex-col items-end gap-1 text-right">
        <Button
          size="sm"
          icon={Pencil}
          disabled
          aria-label="Edit profile"
          aria-describedby="profile-edit-offline"
          data-edit-basics=""
        >
          Edit
        </Button>
        <p id="profile-edit-offline" className="text-muted max-w-40 text-xs" data-needs-connection="">
          {PROFILE_NEEDS_CONNECTION}
        </p>
      </div>
    );
  return (
    <Button
      to={appUrls.profile(groupId, "basics")}
      state={PROFILE_SHEET_STATE}
      prefetch="render"
      preventScrollReset
      size="sm"
      icon={Pencil}
      className="shrink-0"
      aria-label="Edit profile"
      data-edit-basics=""
    >
      Edit
    </Button>
  );
}

/** The emergency sheet (writers only: their devices have the details it prints). */
function PrintLink({ groupId }: { groupId: string }) {
  return (
    <Button
      to={appUrls.profilePrint(groupId)}
      prefetch="render"
      size="sm"
      icon={Printer}
      aria-label="Print emergency sheet"
      data-print-link=""
    >
      Print
    </Button>
  );
}
