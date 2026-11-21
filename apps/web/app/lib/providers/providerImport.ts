import type {
  ProviderContentInput,
  ProviderPhone,
  ProviderStatus,
  ProviderType,
} from "@caretook/data/schema";

import { isPracticeType } from "@caretook/data/schema";
import { fold } from "./providerDirectory";

// Importing providers from another care group the user belongs to: a copy,
// not a share. Pure and client-safe; `importProviders` (providers.sync.ts)
// writes what it plans, and web:unit tests it.
//
// - Copied: type, name, specialty, phones, email, address, website and
//   status. `isPrimary` is off (the other group's primary isn't this one's).
//   Provider notes, links and tasks stay behind.
// - Already here: a live provider in the target with the same type and name
//   (folded: case, accents and spacing ignored). Skipped.
// - A clinician's or other contact's practice maps to a live practice or
//   pharmacy here with the same type and name, else it's copied too (once,
//   however many of its clinicians come along). A deleted (or missing)
//   source practice isn't copied, and the copy has no practice.
// - Rows come practices first, so a clinician's practice exists before it.

/** A provider in the source group, as the device lists it (deleted ones may be included). */
export type ImportSource = {
  id: string;
  type: ProviderType;
  name: string;
  specialty: string | null;
  practiceId: string | null;
  phones: ProviderPhone[];
  email: string | null;
  address: string | null;
  website: string | null;
  status: ProviderStatus;
  isPrimary: boolean;
  deletedAt: string | null;
};

/** A provider in the target group (deleted ones are ignored). */
export type ImportTarget = { id: string; type: ProviderType; name: string; deletedAt: string | null };

/** A provider to create in the target: its new id, the source it copies, and its content. */
export type ImportRow = { id: string; sourceId: string; content: ProviderContentInput };

/** What happened to one chosen provider. */
export type ImportResult = {
  sourceId: string;
  /** `added`: copied here; `alreadyHere`: the same type and name is here, so it was skipped. */
  status: "added" | "alreadyHere";
  /** The provider here: the new copy, or the one that was already here. */
  id: string;
  /** For a copied clinician or other contact: its practice here was `reused` or `copied`; else null. */
  practice: "reused" | "copied" | null;
  /** That practice's id here, or null. */
  practiceId: string | null;
};

export type ImportPlan = { rows: ImportRow[]; results: ImportResult[] };

/** A name as duplicates compare it: case, accents and spacing ignored. */
export const foldName = (name: string) => fold(name).replace(/\s+/g, " ").trim();

const keyOf = (p: { type: ProviderType; name: string }) => `${p.type}\u0000${foldName(p.name)}`;

const contentOf = (p: ImportSource, practiceId: string | null): ProviderContentInput => ({
  type: p.type,
  name: p.name,
  specialty: p.specialty,
  practiceId,
  phones: p.phones.map((phone) => ({ ...phone })),
  email: p.email,
  address: p.address,
  website: p.website,
  status: p.status,
  isPrimary: false,
});

/** The ids of source providers that are already here (same type and folded name as a live one). */
export const alreadyHereIds = (source: readonly ImportSource[], target: readonly ImportTarget[]) => {
  const here = new Set(target.filter((t) => !t.deletedAt).map(keyOf));
  return new Set(source.filter((p) => here.has(keyOf(p))).map((p) => p.id));
};

/**
 * Plan copying the chosen source providers into the target. Ids that aren't
 * a live source provider are ignored; each chosen one gets a result, in the
 * order chosen. `newId` makes the copies' ids.
 */
export const planImport = (
  source: readonly ImportSource[],
  target: readonly ImportTarget[],
  chosenIds: readonly string[],
  newId: () => string = () => crypto.randomUUID(),
): ImportPlan => {
  const byId = new Map(source.map((p) => [p.id, p]));
  const original = new Set<string>();
  const here = new Map<string, string>();
  for (const t of target) {
    if (t.deletedAt) continue;
    const key = keyOf(t);
    if (!here.has(key)) here.set(key, t.id);
    original.add(t.id);
  }

  const chosen = [...new Set(chosenIds)]
    .map((id) => byId.get(id))
    .filter((p): p is ImportSource => !!p && !p.deletedAt);
  const practices: ImportRow[] = [];
  const others: ImportRow[] = [];
  const results = new Map<string, ImportResult>();

  /** Copy a provider here unless the same one is; the id here and whether it's new. */
  const place = (p: ImportSource, practiceId: string | null, into: ImportRow[]) => {
    const key = keyOf(p);
    const existing = here.get(key);
    if (existing) return { id: existing, added: false };
    const id = newId();
    here.set(key, id);
    into.push({ id, sourceId: p.id, content: contentOf(p, practiceId) });
    return { id, added: true };
  };

  const noPractice = { practice: null, practiceId: null };

  // Chosen practices first, so a clinician chosen with its practice points at that copy.
  for (const p of chosen.filter((c) => isPracticeType(c.type))) {
    const { id, added } = place(p, null, practices);
    results.set(p.id, { sourceId: p.id, status: added ? "added" : "alreadyHere", id, ...noPractice });
  }
  for (const p of chosen.filter((c) => !isPracticeType(c.type))) {
    if (here.has(keyOf(p))) {
      results.set(p.id, { sourceId: p.id, status: "alreadyHere", id: here.get(keyOf(p))!, ...noPractice });
      continue;
    }
    const sourcePractice = p.practiceId ? byId.get(p.practiceId) : undefined;
    const practice =
      sourcePractice && !sourcePractice.deletedAt && isPracticeType(sourcePractice.type)
        ? place(sourcePractice, null, practices)
        : null;
    const { id } = place(p, practice?.id ?? null, others);
    results.set(p.id, {
      sourceId: p.id,
      status: "added",
      id,
      practice: practice ? (original.has(practice.id) ? "reused" : "copied") : null,
      practiceId: practice?.id ?? null,
    });
  }

  return {
    rows: [...practices, ...others],
    results: chosen.map((p) => results.get(p.id)!),
  };
};
