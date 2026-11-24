import type { MouseEvent } from "react";
import type { To } from "react-router";

import { ArrowLeft } from "lucide-react";
import { Link } from "react-router";
import { buttonClass } from "./buttonClass";

/**
 * The link above a page's heading back to where it belongs ("← Providers"):
 * a small ghost button, pulled left so its arrow lines up with the text
 * below. `className` is for the outer element only (`md:hidden`). `onClick`
 * may go elsewhere itself (calling `preventDefault`), such as a step back in
 * history; `to` is still the link's address.
 */
export function BackLink({
  to,
  label,
  className = "",
  onClick,
}: {
  to: To;
  label: string;
  className?: string;
  onClick?: (event: MouseEvent<HTMLAnchorElement>) => void;
}) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className={`${buttonClass({ variant: "ghost", size: "sm" })} -ml-3 gap-1 ${className}`}
    >
      <ArrowLeft className="size-4" aria-hidden="true" />
      {label}
    </Link>
  );
}
