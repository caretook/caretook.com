import type { AvatarLook, AvatarSize } from "./UserAvatar";

import { splitStack } from "./stack";
import { MoreAvatar, UserAvatar } from "./UserAvatar";

export type StackPerson = {
  id: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
  look?: AvatarLook | null;
};

/**
 * Overlapping avatars, up to `max`, then "+N". One group, named `label` (also
 * its tooltip): the avatars themselves are decorative. Each carries
 * `data-person` with its id.
 */
export function AvatarStack({
  label,
  people,
  max = 3,
  size = "sm",
  className = "",
}: {
  label: string;
  people: readonly StackPerson[];
  max?: number;
  size?: AvatarSize;
  /** Classes for the group (the outer element). */
  className?: string;
}) {
  const { shown, extra } = splitStack(people, max);
  return (
    <div
      role="group"
      aria-label={label}
      title={label}
      className={`flex items-center -space-x-1.5 ${className}`}
    >
      {shown.map((person) => (
        <UserAvatar
          key={person.id}
          data-person={person.id}
          name={person.name}
          email={person.email}
          image={person.image}
          look={person.look}
          size={size}
          className="ring-base-100 ring-2"
        />
      ))}
      {extra > 0 && <MoreAvatar count={extra} size={size} />}
    </div>
  );
}
