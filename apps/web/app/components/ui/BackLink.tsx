import type { To } from "react-router";

import { ArrowLeft } from "lucide-react";
import { Link } from "react-router";
import { buttonClass } from "./buttonClass";

/**
 * The link above a page's heading back to where it belongs ("← Providers"):
 * a small ghost button, pulled left so its arrow lines up with the text
 * below. `className` is for the outer element only (`md:hidden`).
 */
export function BackLink({ to, label, className = "" }: { to: To; label: string; className?: string }) {
  return (
    <Link to={to} className={`${buttonClass({ variant: "ghost", size: "sm" })} -ml-3 gap-1 ${className}`}>
      <ArrowLeft className="size-4" aria-hidden="true" />
      {label}
    </Link>
  );
}
