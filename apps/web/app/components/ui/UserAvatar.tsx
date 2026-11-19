import type { HTMLAttributes } from "react";

import { useState } from "react";
import { userInitials } from "~/lib/initials";

const SIZE = {
  /** 20px: inside a chip. */
  xs: "size-5 text-[0.6rem]",
  /** 28px: editor avatars. */
  sm: "size-7 text-[0.7rem]",
  /** 32px: the account menu's button. */
  md: "size-8 text-xs",
  /** 36px: member lists. */
  lg: "size-9 text-sm",
} as const;

export type AvatarSize = keyof typeof SIZE;

type UserAvatarProps = {
  name?: string | null;
  email?: string | null;
  image?: string | null;
  size?: AvatarSize;
  /** Classes for the avatar (the outer element), such as a ring. */
  className?: string;
} & Omit<HTMLAttributes<HTMLSpanElement>, "className" | "children">;

/**
 * A user's picture, or their initials (name, then email) when there's no
 * image or it fails to load. Decorative: the control or group around it
 * carries the accessible name.
 */
export function UserAvatar({ name, email, image, size = "sm", className = "", ...rest }: UserAvatarProps) {
  const [failed, setFailed] = useState(false);
  const showImage = !!image && !failed;
  return (
    <span
      aria-hidden="true"
      {...rest}
      className={`bg-primary text-primary-content inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold ${SIZE[size]} ${className}`}
    >
      {showImage ? (
        <img src={image} alt="" className="size-full object-cover" onError={() => setFailed(true)} />
      ) : (
        userInitials({ name, email })
      )}
    </span>
  );
}

/** A "+N" disc the size of an avatar. */
export function MoreAvatar({ count, size = "sm" }: { count: number; size?: AvatarSize }) {
  return (
    <span
      aria-hidden="true"
      className={`bg-base-300 text-base-content ring-base-100 inline-flex shrink-0 items-center justify-center rounded-full font-semibold ring-2 ${SIZE[size]}`}
    >
      +{count}
    </span>
  );
}
