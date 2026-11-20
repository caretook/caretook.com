import type { ContactAction } from "../providers/contactActions";

import { mapsHref } from "../providers/contactActions";

// Where an appointment (an event) is: the place typed on it, else the first
// linked provider's address. Pure: the entry page's place row uses it, and
// later screens (Upcoming's map action) can share it. Unit-tested in web:unit.

/** What the rule reads from a linked provider. */
export type PlaceProvider = { name: string; address: string | null; deletedAt?: string | null };

export type ShownPlace = {
  /** The address or place, as it shows (lines joined with commas). */
  text: string;
  /** The provider it comes from, while nothing is typed; null for a typed place. */
  from: string | null;
};

const oneLine = (text: string) =>
  text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .join(", ");

/**
 * The place an event shows: its own place when one is typed, else the first
 * linked provider (in link order) that isn't removed and has an address.
 * Null when there's neither.
 */
export const shownPlace = (place: string | null | undefined, providers: readonly PlaceProvider[]) => {
  const typed = oneLine(place ?? "");
  if (typed) return { text: typed, from: null } satisfies ShownPlace;
  const provider = providers.find((p) => !p.deletedAt && oneLine(p.address ?? ""));
  return provider
    ? ({ text: oneLine(provider.address ?? ""), from: provider.name } satisfies ShownPlace)
    : null;
};

/** The map action for a shown place: "Open <place> in maps", or null when it can't be mapped. */
export const placeMapAction = (shown: ShownPlace | null): ContactAction | null => {
  const href = shown ? mapsHref(shown.text) : null;
  return shown && href ? { kind: "map", href, label: `Open ${shown.text} in maps`, value: shown.text } : null;
};
