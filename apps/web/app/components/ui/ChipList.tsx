import type { To } from "react-router";

import { X } from "lucide-react";
import { Link } from "react-router";
import { buttonClass } from "./buttonClass";

/**
 * A chip that stands for something (a linked provider): a link to it, or
 * plain text when `to` is null; `muted` greys it. With `onRemove`, an ×
 * button named `removeLabel` sits at its end.
 */
export type ListChip = {
  id: string;
  label: string;
  to: To | null;
  muted?: boolean;
  removeLabel?: string;
  onRemove?: () => void;
};

const CHIP = "border-base-300 bg-base-100 inline-flex h-8 items-center rounded-full border text-sm";

/**
 * A wrapping list of chips, named `label` (a `ul`). Unlike `ChipGroup`
 * (filters and suggestions), each chip here is a thing that's already
 * chosen: it opens it, and may be removed.
 */
export function ChipList({
  label,
  chips,
  className = "",
}: {
  label: string;
  chips: readonly ListChip[];
  className?: string;
}) {
  return (
    <ul aria-label={label} className={`flex flex-wrap items-center gap-1.5 ${className}`}>
      {chips.map((chip) => (
        <li
          key={chip.id}
          className={`${CHIP} ${chip.muted ? "text-base-content/50" : ""}`}
          data-chip={chip.id}
        >
          {chip.to === null ? (
            <span className={`px-3 ${chip.onRemove ? "pr-1" : ""}`}>{chip.label}</span>
          ) : (
            <Link
              to={chip.to}
              className={`rounded-full px-3 py-1 hover:underline ${chip.onRemove ? "pr-1" : ""}`}
            >
              {chip.label}
            </Link>
          )}
          {chip.onRemove && (
            <button
              type="button"
              aria-label={chip.removeLabel ?? `Remove ${chip.label}`}
              title={chip.removeLabel ?? `Remove ${chip.label}`}
              onClick={chip.onRemove}
              className={`${buttonClass({ variant: "ghost", size: "xs", shape: "circle" })} mr-1`}
            >
              <X className="size-3.5" aria-hidden="true" />
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
