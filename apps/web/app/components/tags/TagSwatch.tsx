import { tagColorClass } from "~/components/ui";

/**
 * A tag's color as a small dot, beside its name where the name isn't a chip
 * (the picker's toggles, the search page's tag filters): `tagColorClass`, an
 * empty ring for none. Decorative: the name says which tag it is.
 */
export function TagSwatch({ color }: { color: string | null | undefined }) {
  return (
    <span
      aria-hidden="true"
      data-tag-swatch={color ?? ""}
      className={`size-3 shrink-0 rounded-full border ${tagColorClass(color) ?? "border-base-content/40"}`}
    />
  );
}
