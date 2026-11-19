import type { ProviderStatus, ProviderType } from "@caretook/data/schema";

import { isPharmacyType, isPrescriberType } from "@caretook/data/schema";
import {
  compareProviders,
  fold,
  matchesQuery,
  PROVIDER_TYPE_META,
  queryTokens,
} from "../../../../lib/providerDirectory";

// The medication form's prescriber and pharmacy pickers, their pure parts:
// which of the group's providers each offers for the typed text, and when to
// offer adding the typed name as a new one. No React or database; web:unit
// tests it (so imports stay relative). Like the With row's `withProviders`.

export type ProviderRole = "prescriber" | "pharmacy";

export type PickableProvider = {
  id: string;
  type: ProviderType;
  name: string;
  specialty: string | null;
  practiceId: string | null;
  status: ProviderStatus;
  isPrimary: boolean;
  deletedAt: string | null;
};

/** How many choices a picker lists at most. */
export const PICKER_LIMIT = 20;

/** Whether a provider can fill the role: a clinician or practice prescribes, a pharmacy fills. */
export const fitsRole = (role: ProviderRole, type: string) =>
  role === "prescriber" ? isPrescriberType(type) : isPharmacyType(type);

/**
 * The picker's choices for `text`: the group's providers that fit the role
 * and aren't deleted, matching every typed word (name, specialty or
 * practice), in display order. Each says what it is: "Cardiology · Westside
 * Family Medicine", "Practice", "Past".
 */
export const providerOptions = (
  providers: readonly PickableProvider[],
  role: ProviderRole,
  text: string,
  limit = PICKER_LIMIT,
) => {
  const names = new Map(providers.map((p) => [p.id, p.name]));
  const tokens = queryTokens(text);
  return providers
    .filter((p) => !p.deletedAt && fitsRole(role, p.type))
    .filter((p) => matchesQuery(p, tokens, p.practiceId ? names.get(p.practiceId) : null))
    .sort(compareProviders)
    .slice(0, limit)
    .map((p) => {
      const practice = p.practiceId ? names.get(p.practiceId) : null;
      const what = p.specialty || PROVIDER_TYPE_META[p.type].label;
      const parts = [what, practice, p.status === "past" ? "Past" : null].filter(Boolean);
      return { id: p.id, label: p.name, description: parts.join(" · ") };
    });
};

/**
 * Whether to offer adding the typed name as a new prescriber or pharmacy:
 * there's text, and no live provider that fits the role has that name
 * already (case and accents ignored).
 */
export const canAddProvider = (providers: readonly PickableProvider[], role: ProviderRole, text: string) => {
  const name = fold(text.trim());
  if (!name) return false;
  return !providers.some((p) => !p.deletedAt && fitsRole(role, p.type) && fold(p.name.trim()) === name);
};

/** What a chosen provider's chip says: its name, "(removed)" once deleted, "(new)" before it's saved. */
export const chosenLabel = (name: string, { deleted = false, isNew = false } = {}) =>
  isNew ? `${name} (new)` : deleted ? `${name} (removed)` : name;
