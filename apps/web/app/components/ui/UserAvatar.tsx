import type { HTMLAttributes } from "react";

import { useState } from "react";
import { userInitials } from "~/lib/initials";

type UserAvatarProps = {
  name?: string | null;
  email?: string | null;
  image?: string | null;
  /** Size, text size and any ring; the default is the 28px editor avatar. */
  className?: string;
} & Omit<HTMLAttributes<HTMLSpanElement>, "className" | "children">;

/**
 * A user's picture, or their initials (name, then email) when there's no
 * image or it fails to load. Decorative: the control or group around it
 * carries the accessible name.
 */
export function UserAvatar({
  name,
  email,
  image,
  className = "size-7 text-[0.7rem]",
  ...rest
}: UserAvatarProps) {
  const [failed, setFailed] = useState(false);
  const showImage = !!image && !failed;
  return (
    <span
      aria-hidden="true"
      {...rest}
      className={`bg-primary text-primary-content inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold ${className}`}
    >
      {showImage ? (
        <img src={image} alt="" className="size-full object-cover" onError={() => setFailed(true)} />
      ) : (
        userInitials({ name, email })
      )}
    </span>
  );
}
