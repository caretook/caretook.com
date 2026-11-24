import type { HTMLAttributes } from "react";

import { createElement, useState } from "react";
import { userInitials } from "~/lib/core/initials";
import { avatarColorClass, avatarIconGlyph } from "./avatarLook";

const SIZE = {
  /** 20px: inside a chip. */
  xs: "size-5 text-[0.6rem]",
  /** 24px: an author on a timeline or Planner row. */
  row: "size-6 text-[0.65rem]",
  /** 28px: editor avatars. */
  sm: "size-7 text-[0.7rem]",
  /** 32px: the account menu's button. */
  md: "size-8 text-xs",
  /** 36px: member lists. */
  lg: "size-9 text-sm",
} as const;

export type AvatarSize = keyof typeof SIZE;
export type AvatarLook = {
  color?: string | null;
  icon?: string | null;
  /** The color when none is chosen (a member's in this group); a picture still wins over it. */
  defaultColor?: string | null;
  /** Someone no longer in the group: initials on a neutral disc. */
  neutral?: boolean;
};

type UserAvatarProps = {
  name?: string | null;
  email?: string | null;
  image?: string | null;
  /** The member's chosen color and icon ids, and their default. */
  look?: AvatarLook | null;
  size?: AvatarSize;
  /** Classes for the avatar (the outer element), such as a ring. */
  className?: string;
} & Omit<HTMLAttributes<HTMLSpanElement>, "className" | "children">;

/**
 * A user's look: a chosen color shows their initials on it, a chosen icon
 * replaces the initials, and either wins over `image`. With neither, their
 * picture, or their initials (name, then email) on their default color when
 * there's no image or it fails to load. An id this version doesn't know counts
 * as unset. Decorative: the control or group around it carries the accessible
 * name.
 */
export function UserAvatar({
  name,
  email,
  image,
  look,
  size = "sm",
  className = "",
  ...rest
}: UserAvatarProps) {
  const [failed, setFailed] = useState(false);
  const chosen = avatarColorClass(look?.color);
  const glyph = avatarIconGlyph(look?.icon);
  const neutral = !!look?.neutral;
  const showImage = !!image && !failed && !chosen && !glyph && !neutral;
  const shownColor = chosen ? look?.color : avatarColorClass(look?.defaultColor) ? look?.defaultColor : null;
  const colorClass = neutral
    ? "bg-base-300 text-base-content"
    : (avatarColorClass(shownColor) ?? "bg-primary text-primary-content");
  return (
    <span
      aria-hidden="true"
      data-avatar-color={!neutral && !showImage && shownColor ? shownColor : undefined}
      data-avatar-default={!neutral && !chosen && !showImage && shownColor ? "" : undefined}
      data-avatar-neutral={neutral ? "" : undefined}
      data-avatar-icon={glyph ? look?.icon : undefined}
      {...rest}
      className={`${colorClass} inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold ${SIZE[size]} ${className}`}
    >
      {glyph ? (
        createElement(glyph, { className: "size-3/5" })
      ) : showImage ? (
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
