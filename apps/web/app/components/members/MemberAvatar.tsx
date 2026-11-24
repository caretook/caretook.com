import type { ComponentProps } from "react";

import { UserAvatar } from "~/components/ui";
import { useMemberLook } from "~/lib/care-groups/useMemberLooks";

type MemberAvatarProps = Omit<ComponentProps<typeof UserAvatar>, "look"> & {
  /** Whose avatar; someone who isn't in this group shows neutral with initials. */
  userId: string | null | undefined;
};

/** A person's avatar with their look in the current group. Only under the group route. */
export function MemberAvatar({ userId, ...avatar }: MemberAvatarProps) {
  return <UserAvatar look={useMemberLook(userId)} {...avatar} />;
}
