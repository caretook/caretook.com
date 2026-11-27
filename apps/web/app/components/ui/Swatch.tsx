import type { ReactNode } from "react";

import { useId } from "react";

/**
 * One round choice in a `SwatchGroup`: a native radio (visually hidden,
 * named by `label`, which is also its tooltip) with its look beside it, a
 * 44px circle in `className`'s fill (an `avatarColorClass` or
 * `tagColorClass`), an optional glyph inside. Checked: a ring; focused: an
 * outline. Radios sharing a `name` are one choice.
 */
export function Swatch({
  name,
  label,
  checked,
  onChange,
  className,
  children,
  ...data
}: {
  name: string;
  label: string;
  checked: boolean;
  onChange: () => void;
  /** The circle's fill (whole classes). */
  className: string;
  children?: ReactNode;
} & { [attr: `data-${string}`]: string | undefined }) {
  return (
    <label title={label} className="cursor-pointer">
      <input
        {...data}
        type="radio"
        name={name}
        aria-label={label}
        checked={checked}
        onChange={onChange}
        className="peer sr-only"
      />
      <span
        className={`ring-offset-base-100 peer-checked:ring-base-content peer-focus-visible:outline-primary flex size-11 items-center justify-center rounded-full ring-offset-2 peer-checked:ring-2 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 ${className}`}
      >
        {children}
      </span>
    </label>
  );
}

/** A named `radiogroup` of `Swatch`es, its label shown above them. */
export function SwatchGroup({ label, children }: { label: string; children: ReactNode }) {
  const id = useId();
  return (
    <div className="space-y-2">
      <p id={id} className="text-sm font-semibold">
        {label}
      </p>
      <div role="radiogroup" aria-labelledby={id} className="flex flex-wrap gap-2">
        {children}
      </div>
    </div>
  );
}
