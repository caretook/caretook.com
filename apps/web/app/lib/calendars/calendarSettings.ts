import type { ReminderLead } from "@caretook/data/schema";
import type { ApiOutputs } from "../core/rpc";

import { ORPCError } from "@orpc/client";
import { shareLevel } from "@caretook/data/schema";
import { useSyncExternalStore } from "react";
import { redirect } from "react-router";
import { load } from "../core/api";
import { signInUrl } from "../core/redirect";
import { rpc } from "../core/rpc";

// A member's own calendar settings for one group (appointments-2): the
// Calendar & reminders page's reminders and details consent. They live on
// the server only (`calendars.settings.*`), so the last copy is cached per
// user and group on the device, and a change made offline is kept as
// *pending* until the server has it, as `saveSettings` does for the
// account's settings: `saveCalendarSettings` tries at once, and
// `loadCalendarSettings` (the page's loader, which reruns when the
// connection is back) sends what's left before reading the server's copy.
// Sign-out forgets both (`forgetCalendarSettings`).

export type CalendarSettings = ApiOutputs["calendars"]["settings"]["get"];

/** What a member changes: the parts `calendars.settings.update` takes. */
export type CalendarChange = {
  remindersOn?: boolean;
  reminderLeads?: ReminderLead[];
  detailsConsent?: boolean;
};

const PREFIX = "caretook:calendar:";
const PENDING_PREFIX = "caretook:calendar-pending:";
const keyOf = (userId: string, groupId: string) => `${userId}:${groupId}`;

const readJson = <T>(key: string): T | null => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
};

const writeJson = (key: string, value: unknown) => {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage unavailable: nothing is kept offline.
  }
};

/** A change on top of settings, as the server will make it (consent's time comes from the server). */
export const withChange = (settings: CalendarSettings, change: CalendarChange): CalendarSettings => {
  const next = { ...settings };
  if (change.remindersOn !== undefined) next.remindersOn = change.remindersOn;
  if (change.reminderLeads !== undefined) next.reminderLeads = change.reminderLeads;
  if (change.detailsConsent !== undefined && change.detailsConsent !== settings.detailsConsent) {
    next.detailsConsent = change.detailsConsent;
    next.detailsConsentAt = null;
    next.detailsConsentVersion = null;
  }
  next.shareLevel = shareLevel({
    memberConsent: next.detailsConsent,
    groupAllowsDetails: next.groupAllowsDetails,
  });
  return next;
};

/** What's left of `pending` once `sent` has reached the server (fields changed again since stay). */
export const leftAfterSending = (pending: CalendarChange, sent: CalendarChange): CalendarChange | null => {
  const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
  const left: CalendarChange = { ...pending };
  for (const field of Object.keys(sent) as (keyof CalendarChange)[])
    if (same(left[field], sent[field])) delete left[field];
  return Object.keys(left).length ? left : null;
};

const readCache = (key: string) => readJson<CalendarSettings>(PREFIX + key);
const readPending = (key: string) => readJson<CalendarChange>(PENDING_PREFIX + key);

const clearPending = (key: string, sent: CalendarChange) => {
  const pending = readPending(key);
  if (pending) writeJson(PENDING_PREFIX + key, leftAfterSending(pending, sent));
};

/** The settings this device knows now: the cached copy with pending changes on top, or null. */
export const knownCalendarSettings = (userId: string, groupId: string): CalendarSettings | null => {
  const key = keyOf(userId, groupId);
  const cached = readCache(key);
  if (!cached) return null;
  const pending = readPending(key);
  return pending ? withChange(cached, pending) : cached;
};

/** What each user and group's settings were when last published, and who's listening. */
const published = new Map<string, { json: string; settings: CalendarSettings | null }>();
const listeners = new Set<() => void>();

const publish = (userId: string, groupId: string) => {
  const key = keyOf(userId, groupId);
  const settings = knownCalendarSettings(userId, groupId);
  const json = JSON.stringify(settings);
  const last = published.get(key);
  if (last?.json === json) return last.settings;
  published.set(key, { json, settings });
  for (const listener of listeners) listener();
  return settings;
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** The settings, live: `initial` (the loader's) until a save or load on this device publishes newer ones. */
export const useCalendarSettings = (
  userId: string,
  groupId: string,
  initial: CalendarSettings | null,
): CalendarSettings | null =>
  useSyncExternalStore(
    subscribe,
    () => {
      const known = published.get(keyOf(userId, groupId));
      return known ? known.settings : initial;
    },
    () => initial,
  );

/** fetch fails with a TypeError when there's no connection. */
const isNetworkError = (e: unknown) => e instanceof TypeError;
/** A lost session: keep what's pending for after the next sign-in. */
const isSignedOut = (e: unknown) => e instanceof ORPCError && e.code === "UNAUTHORIZED";

const cache = (userId: string, groupId: string, settings: CalendarSettings) => {
  writeJson(PREFIX + keyOf(userId, groupId), settings);
  return publish(userId, groupId);
};

/**
 * Change some settings: marked pending at once (and shown, when there's a
 * cached copy), then sent. Resolves `"saved"` when the server has them, or
 * `"pending"` offline (the page's next online load sends them). A refused
 * change (details the owners forbid, say) is dropped and rejects with the
 * API's error.
 */
export const saveCalendarSettings = async (
  userId: string,
  groupId: string,
  change: CalendarChange,
): Promise<"saved" | "pending"> => {
  const key = keyOf(userId, groupId);
  writeJson(PENDING_PREFIX + key, { ...readPending(key), ...change });
  publish(userId, groupId);
  try {
    const saved = await rpc.calendars.settings.update({ groupId, ...change });
    clearPending(key, change);
    cache(userId, groupId, saved);
    return "saved";
  } catch (e) {
    if (isNetworkError(e)) return "pending";
    if (!isSignedOut(e)) {
      clearPending(key, change);
      publish(userId, groupId);
    }
    throw e;
  }
};

export type LoadedCalendarSettings = { online: boolean; settings: CalendarSettings | null };

/**
 * The page's settings: what's pending is sent first, then the server's copy
 * is read and cached. Without a connection, the device's copy (cached with
 * pending on top), or null when it has none. A lost session goes to sign-in,
 * and a group the member isn't in is a 404 (`load`).
 */
export const loadCalendarSettings = async (
  request: Request,
  userId: string,
  groupId: string,
): Promise<LoadedCalendarSettings> => {
  const key = keyOf(userId, groupId);
  const offline = () => ({ online: false, settings: publish(userId, groupId) });
  const pending = readPending(key);
  if (pending) {
    try {
      await rpc.calendars.settings.update({ groupId, ...pending });
      clearPending(key, pending);
    } catch (e) {
      if (isNetworkError(e)) return offline();
      if (isSignedOut(e)) throw redirect(signInUrl(request));
      if (!(e instanceof ORPCError)) throw e;
      // Refused (details forbidden since, say): drop it and use the server's copy.
      clearPending(key, pending);
    }
  }
  try {
    const settings = await load(request, rpc.calendars.settings.get({ groupId }));
    return { online: true, settings: cache(userId, groupId, settings) };
  } catch (e) {
    if (isNetworkError(e)) return offline();
    throw e;
  }
};

/** Forget every cached copy and pending change on this device (sign-out). */
export const forgetCalendarSettings = () => {
  published.clear();
  try {
    for (const key of Object.keys(localStorage))
      if (key.startsWith(PREFIX) || key.startsWith(PENDING_PREFIX)) localStorage.removeItem(key);
  } catch {
    // Nothing cached.
  }
};
