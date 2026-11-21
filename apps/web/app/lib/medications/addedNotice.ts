// The notice after the Dose sheet's quick add ("+ New medication"): "Added
// Ibuprofen · Add details" for about 10 s once the sheet has closed, its
// action opening the new medication's edit sheet. It goes at the next
// navigation after the one that closed the sheet. One at a time: a newer
// one replaces it. Plain module state (no React), so the sheet that offers
// it can close; the timeline shows it (`AddedMedicationToast`). Pure apart
// from the clock; web:unit tests it.

/** How long the notice stays. */
export const ADDED_NOTICE_MS = 10_000;

export type AddedNotice = {
  /** A fresh key per notice, so each is announced. */
  key: string;
  groupId: string;
  medicationId: string;
  /** "Ibuprofen", as saved. */
  name: string;
  /** The sheet's path: the notice waits until the page has left it. */
  from: string;
  /** The location (its key) the notice was first shown at; a later one ends it. */
  landedAt: string | null;
  /** Epoch ms after which it's gone. */
  expiresAt: number;
};

let current: AddedNotice | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/** Offer the notice for a medication just added from the sheet at `from`. */
export function offerAddedNotice(
  notice: Pick<AddedNotice, "groupId" | "medicationId" | "name" | "from">,
  now = Date.now(),
) {
  current = {
    ...notice,
    key: `${now}-${notice.medicationId}`,
    landedAt: null,
    expiresAt: now + ADDED_NOTICE_MS,
  };
  emit();
}

/** The notice's message. */
export const addedNoticeText = (notice: Pick<AddedNotice, "name">) => `Added ${notice.name}`;

/**
 * The notice to show at this location in this group, or null: none, another
 * group's, expired, still on the sheet, or a navigation past where it landed.
 */
export function addedNoticeAt(
  groupId: string,
  { pathname, locationKey, now = Date.now() }: { pathname: string; locationKey: string; now?: number },
): AddedNotice | null {
  if (!current || current.groupId !== groupId || current.expiresAt <= now) return null;
  if (pathname === current.from) return null;
  if (current.landedAt !== null && current.landedAt !== locationKey) return null;
  return current;
}

/**
 * Keep the notice in step with the page: it lands at the first location
 * past its sheet, and goes at the next one.
 */
export function followLocation(
  groupId: string,
  { pathname, locationKey }: { pathname: string; locationKey: string },
) {
  if (!current || current.groupId !== groupId || pathname === current.from) return;
  if (current.landedAt === null) {
    current = { ...current, landedAt: locationKey };
    emit();
  } else if (current.landedAt !== locationKey) clearAddedNotice(current.key);
}

/** Take the notice away (its time is up, or it was used). Only `key`'s, when given. */
export function clearAddedNotice(key?: string) {
  if (!current || (key && current.key !== key)) return;
  current = null;
  emit();
}

export function subscribeAddedNotice(listener: () => void) {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

/** The current notice, for `useSyncExternalStore`. */
export const addedNoticeSnapshot = () => current;
