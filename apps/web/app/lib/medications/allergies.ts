import type { AllergySeverity } from "@caretook/data/schema";

import { foldSearchText } from "@caretook/data/domain";

// The recipient's allergies, in words: one line per allergy, the region's
// three states, and the medication form's warning. Pure: web:unit tests it;
// the list, a medication's page, the allergies sheet, the printed sheets and
// the name field use it.

export type AllergyLike = {
  id: string;
  substance: string;
  reaction: string | null;
  severity: AllergySeverity;
};

export const SEVERITY_LABELS: Record<AllergySeverity, string> = {
  mild: "Mild",
  moderate: "Moderate",
  severe: "Severe",
  unknown: "Severity not known",
};

const SEVERITY_RANK: Record<AllergySeverity, number> = { severe: 0, moderate: 1, mild: 2, unknown: 3 };

const collator = new Intl.Collator("en", { sensitivity: "base", numeric: true });

/** Most severe first, then by substance: what's seen first is what matters most. */
export const sortAllergies = <A extends AllergyLike>(allergies: readonly A[]): A[] =>
  [...allergies].sort(
    (a, b) =>
      SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] ||
      collator.compare(a.substance, b.substance) ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );

/** "Penicillin (hives, severe)", "Sulfa (rash)", "Latex (severe)", "Peanuts". */
export const allergyText = ({ substance, reaction, severity }: Omit<AllergyLike, "id">) => {
  const details = [reaction?.trim(), severity === "unknown" ? null : severity].filter(Boolean);
  return details.length ? `${substance} (${details.join(", ")})` : substance;
};

/** The region's three states: allergies on file, "No known allergies", or nothing recorded yet. */
export type AllergyState<A extends AllergyLike = AllergyLike> =
  { kind: "recorded"; allergies: A[] } | { kind: "none" } | { kind: "notRecorded" };

/** Allergies on file win over a stale "No known allergies" (adding one clears it anyway). */
export const allergyState = <A extends AllergyLike>(
  allergies: readonly A[],
  noKnownAllergiesAt: string | null,
): AllergyState<A> =>
  allergies.length
    ? { kind: "recorded", allergies: sortAllergies(allergies) }
    : noKnownAllergiesAt
      ? { kind: "none" }
      : { kind: "notRecorded" };

export const NO_KNOWN_ALLERGIES = "No known allergies";
export const ALLERGIES_NOT_RECORDED = "Allergies not recorded";

/** The region's line: "Penicillin (hives, severe) · Sulfa", "No known allergies" or "Allergies not recorded". */
export const allergySummary = (state: AllergyState) =>
  state.kind === "recorded"
    ? state.allergies.map(allergyText).join(" · ")
    : state.kind === "none"
      ? NO_KNOWN_ALLERGIES
      : ALLERGIES_NOT_RECORDED;

const words = (text: string) =>
  foldSearchText(text)
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);

const allIn = (needles: readonly string[], haystack: ReadonlySet<string>) =>
  needles.length > 0 && needles.every((w) => haystack.has(w));

/**
 * The allergies a medication's name matches, in `sortAllergies` order. Case
 * and accents are folded, and words are whole: every word of the substance
 * is in the name ("Penicillin" on "Penicillin VK"), or every word of the
 * name is in the substance ("Sulfa" on "Sulfa drugs"). "Penicillin" never
 * matches "Amoxicillin": plain words, no drug families.
 */
export const allergyMatches = <A extends AllergyLike>(name: string, allergies: readonly A[]): A[] => {
  const nameWords = words(name);
  if (!nameWords.length) return [];
  const nameSet = new Set(nameWords);
  return sortAllergies(
    allergies.filter((a) => {
      const substance = words(a.substance);
      return allIn(substance, nameSet) || allIn(nameWords, new Set(substance));
    }),
  );
};

/** One matched allergy for the warning: "Penicillin (severe)", or just "Sulfa" when the severity isn't known. */
const matchText = ({ substance, severity }: AllergyLike) =>
  severity === "unknown" ? substance : `${substance} (${severity})`;

/**
 * The name field's warning, or null: "Matches an allergy on file: Penicillin
 * (severe)". It never says a name is safe, and it never blocks a save.
 */
export const allergyWarning = (matches: readonly AllergyLike[]) => {
  if (matches.length === 0) return null;
  const list = matches.map(matchText).join(", ");
  return matches.length === 1 ? `Matches an allergy on file: ${list}` : `Matches allergies on file: ${list}`;
};
