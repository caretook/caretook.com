import type { AnnouncementTone } from "@caretook/data/schema";

import { activeAnnouncement, ANNOUNCEMENT_TONES } from "@caretook/data/schema";

// The `/app` banner on the device (admin slice 6): staff post it in
// /admin/settings, `public.announcement` serves it, and the device keeps the
// last answer, so it still shows offline (and in the native build) until it
// ends. A dismissal is remembered per announcement, per device. The rule
// that picks what to show is pure; the storage around it never throws, and
// storage that throws means the banner shows (nothing is remembered).

export type DeviceAnnouncement = {
  /** From its tone and text (see `announcementId` in @caretook/api). */
  id: string;
  text: string;
  tone: AnnouncementTone;
  endsAt: string | null;
};

export const ANNOUNCEMENT_CACHE_KEY = "caretook:announcement";
export const ANNOUNCEMENT_DISMISSED_KEY = "caretook:announcement-dismissed";
/** Dismissals kept (the newest); older ones fall off. */
export const DISMISSED_KEEP = 20;
/** How often navigating in /app asks the server again. */
export const ANNOUNCEMENT_REFETCH_MS = 60_000;

/**
 * What the banner shows: the server's answer when there is one (`fetched`
 * null means there's none now), else the cached one; nothing once it has
 * ended or when it was dismissed on this device.
 */
export function pickAnnouncement({
  fetched,
  cached,
  dismissed,
  now,
}: {
  /** The server's latest answer; undefined when it hasn't answered (offline, native without a connection). */
  fetched: DeviceAnnouncement | null | undefined;
  cached: DeviceAnnouncement | null;
  dismissed: readonly string[];
  now: number;
}): DeviceAnnouncement | null {
  const source = fetched === undefined ? cached : fetched;
  const active = activeAnnouncement(source, now);
  if (!active || dismissed.includes(active.id)) return null;
  return active;
}

/** A stored or fetched value as an announcement, or null when it isn't one. */
export function parseDeviceAnnouncement(value: unknown): DeviceAnnouncement | null {
  if (!value || typeof value !== "object") return null;
  const { id, text, tone, endsAt } = value as Record<string, unknown>;
  if (typeof id !== "string" || !id || typeof text !== "string") return null;
  if (!ANNOUNCEMENT_TONES.includes(tone as AnnouncementTone)) return null;
  if (endsAt !== null && endsAt !== undefined && typeof endsAt !== "string") return null;
  return { id, text, tone: tone as AnnouncementTone, endsAt: endsAt ?? null };
}

/** The dismissed ids with `id` added last (once), keeping the newest `DISMISSED_KEEP`. */
export function withDismissed(dismissed: readonly string[], id: string): string[] {
  return [...dismissed.filter((d) => d !== id), id].slice(-DISMISSED_KEEP);
}

/** Milliseconds until `announcement` ends (null when it has no end), for re-checking then. */
export function msUntilEnd(announcement: DeviceAnnouncement | null, now: number): number | null {
  if (!announcement?.endsAt) return null;
  const ends = Date.parse(announcement.endsAt);
  return Number.isNaN(ends) ? null : Math.max(0, ends - now);
}

// --- Storage (never throws) -------------------------------------------------------

const read = (key: string): unknown => {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? null : (JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
};

const write = (key: string, value: unknown) => {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage unavailable: nothing is remembered past this page.
  }
};

export const readCachedAnnouncement = () => parseDeviceAnnouncement(read(ANNOUNCEMENT_CACHE_KEY));

/** Keeps the server's answer (null forgets the cached one). */
export const cacheAnnouncement = (announcement: DeviceAnnouncement | null) =>
  write(ANNOUNCEMENT_CACHE_KEY, announcement);

export const readDismissed = (): string[] => {
  const value = read(ANNOUNCEMENT_DISMISSED_KEY);
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
};

export const saveDismissed = (dismissed: readonly string[]) => write(ANNOUNCEMENT_DISMISSED_KEY, dismissed);
