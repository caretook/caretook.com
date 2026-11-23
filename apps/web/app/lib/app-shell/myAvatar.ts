import type { AvatarChoice } from "@caretook/data/schema";

import { ORPCError } from "@orpc/client";
import { NO_AVATAR_CHOICE, readAvatarChoice } from "@caretook/data/schema";
import { useEffect, useSyncExternalStore } from "react";
import { useLocation } from "react-router";
import { NETWORK_ANSWER_MS, withTimeout } from "../auth/sessionRules";
import { rpc } from "../core/rpc";

// The signed-in member's own avatar choice, for the header and the picker. It
// lives on `user`, whose synced row a member with no group doesn't have, so the
// device keeps its own copy: the server's last answer, and on top of it a
// pending choice until the server has it (a whole choice; null clears a field).
//
// This queue is the avatar's own, never `updatePreferences`: that input is
// strict, and a refusal there drops the whole queued batch. Sends run one at a
// time, so the server ends on the latest choice. Only a real refusal drops a
// pending choice; a lost connection, a lost session or a server error keeps it
// for the next save, navigation or reconnect.

const CACHE_PREFIX = "caretook:avatar:";
const PENDING_PREFIX = "caretook:avatar-pending:";
const cacheKey = (userId: string) => `${CACHE_PREFIX}${userId}`;
const pendingKey = (userId: string) => `${PENDING_PREFIX}${userId}`;
/** What the server last accepted from this device, until the synced row shows it. */
const SENT_PREFIX = "caretook:avatar-sent:";
const sentKey = (userId: string) => `${SENT_PREFIX}${userId}`;

/** What couldn't be stored (private mode, a full disk): kept for this page load. */
const unstored = new Map<string, string>();

const readStored = (key: string): unknown => {
  try {
    const raw = unstored.get(key) ?? localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as unknown) : null;
  } catch {
    return null;
  }
};

const writeStored = (key: string, value: unknown) => {
  unstored.delete(key);
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    if (value !== null) unstored.set(key, JSON.stringify(value));
  }
};

const isIdOrNull = (value: unknown) => value === null || typeof value === "string";

/**
 * The queued choice, ids as stored: one this version doesn't know goes to the
 * server to refuse, rather than reading as unset and clearing the field there.
 */
const readPending = (userId: string) => readChoiceAt(pendingKey(userId));

const readChoiceAt = (key: string): AvatarChoice | null => {
  const stored = readStored(key);
  if (typeof stored !== "object" || stored === null) return null;
  const { color, icon } = stored as { color?: unknown; icon?: unknown };
  return isIdOrNull(color) && isIdOrNull(icon) ? ({ color, icon } as AvatarChoice) : null;
};

const clearPendingIf = (userId: string, sent: AvatarChoice) => {
  const pending = readPending(userId);
  if (pending?.color === sent.color && pending.icon === sent.icon) writeStored(pendingKey(userId), null);
};

/** The last choice read for each user, so a snapshot stays one object until it changes. */
const snapshots = new Map<string, { json: string; choice: AvatarChoice }>();
const listeners = new Set<() => void>();

/** What this device knows of the choice: the pending one, else the server's last answer. */
const snapshot = (userId: string): AvatarChoice => {
  const choice = readAvatarChoice(readPending(userId) ?? readStored(cacheKey(userId)));
  const json = JSON.stringify(choice);
  const last = snapshots.get(userId);
  if (last?.json === json) return last.choice;
  snapshots.set(userId, { json, choice });
  return choice;
};

const publish = () => {
  for (const listener of listeners) listener();
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** A real refusal. A lost session, a rate limit or a server error isn't one: those are retried. */
const isRefused = (e: unknown) =>
  e instanceof ORPCError && e.status >= 400 && e.status < 500 && ![401, 408, 429].includes(e.status);

type Sent = { outcome: "saved" } | { outcome: "pending" } | { outcome: "refused"; error: unknown };

/** Bumped by every save, accepted send and sign-out: a `me.get` answer from before one is stale. */
let writes = 0;
/** Bumped by sign-out: a send that outlives one writes nothing. */
let forgotten = 0;
/** Each user's send in flight: a save during it joins it, and it picks up the newer choice. */
const sending = new Map<string, Promise<Sent>>();

const drain = async (userId: string, epoch: number): Promise<Sent> => {
  let last: Sent = { outcome: "saved" };
  try {
    for (;;) {
      const sent = readPending(userId);
      if (!sent) return last;
      try {
        const { avatar } = await rpc.me.setAvatar(sent);
        if (epoch !== forgotten) return { outcome: "pending" };
        writes++;
        writeStored(cacheKey(userId), readAvatarChoice(avatar));
        writeStored(sentKey(userId), readAvatarChoice(avatar));
        clearPendingIf(userId, sent);
        last = { outcome: "saved" };
      } catch (error) {
        if (epoch !== forgotten || !isRefused(error)) return { outcome: "pending" };
        clearPendingIf(userId, sent);
        last = { outcome: "refused", error };
      }
      publish();
    }
  } finally {
    // In the same tick as the last pending check, so no save can join a finished send.
    if (epoch === forgotten) sending.delete(userId);
  }
};

/** Send what's pending, if anything, joining a send already running. */
const sendPending = (userId: string): Promise<Sent> => {
  const running = sending.get(userId);
  if (running) return running;
  if (!readPending(userId)) return Promise.resolve({ outcome: "saved" });
  const epoch = forgotten;
  const run = Promise.resolve().then(() => drain(userId, epoch));
  sending.set(userId, run);
  return run;
};

const asked = new Set<string>();

/** Send what's pending, then read the server's copy once per page load. */
const refresh = async (userId: string) => {
  const epoch = forgotten;
  await sendPending(userId);
  if (epoch !== forgotten || readPending(userId) || asked.has(userId)) return;
  asked.add(userId);
  const since = writes;
  try {
    const me = await rpc.me.get();
    if (since !== writes) return;
    const answer = readAvatarChoice(me.avatar);
    writeStored(cacheKey(userId), answer);
    // Another device may have chosen since: wait for the server's answer, or the
    // overlay would wait for a row that never comes.
    if (readChoiceAt(sentKey(userId))) writeStored(sentKey(userId), answer);
    publish();
  } catch {
    // Offline or signed out: the next navigation or reconnect asks again.
    asked.delete(userId);
  }
};

/** The member's choice, live: from this device at once, then the server's. */
export const useMyAvatar = (userId: string): AvatarChoice => {
  const { key } = useLocation();
  useEffect(() => {
    const retry = () => void refresh(userId);
    retry();
    window.addEventListener("online", retry);
    return () => window.removeEventListener("online", retry);
  }, [userId, key]);
  return useSyncExternalStore(
    subscribe,
    () => snapshot(userId),
    () => NO_AVATAR_CHOICE,
  );
};

/** Your choice that the synced row doesn't show yet: pending, else last accepted. */
export const myAvatarOverlay = (userId: string): AvatarChoice | null => {
  const raw = readPending(userId) ?? readChoiceAt(sentKey(userId));
  if (!raw) return null;
  const choice = readAvatarChoice(raw);
  const json = JSON.stringify(choice);
  const key = `overlay:${userId}`;
  const last = snapshots.get(key);
  if (last?.json === json) return last.choice;
  snapshots.set(key, { json, choice });
  return choice;
};

/** The synced row has caught up with what was accepted: the overlay ends. */
export const settleMyAvatar = (userId: string, synced: AvatarChoice) => {
  const sent = readChoiceAt(sentKey(userId));
  if (!sent) return;
  const shown = readAvatarChoice(sent);
  if (shown.color !== synced.color || shown.icon !== synced.icon) return;
  writeStored(sentKey(userId), null);
  publish();
};

/**
 * Your own choice to show over your synced row (`synced`; null while it isn't
 * on the device), or null when the row is current.
 */
export const useMyAvatarOverlay = (userId: string, synced: AvatarChoice | null) => {
  const overlay = useSyncExternalStore(
    subscribe,
    () => myAvatarOverlay(userId),
    () => null,
  );
  useEffect(() => {
    if (synced) settleMyAvatar(userId, synced);
  }, [userId, synced, overlay]);
  return overlay;
};

/**
 * Save a whole choice (null clears a field): it shows at once and is queued,
 * then sent. Resolves `"saved"` when the server has it, or `"pending"` when it
 * stays queued. Rejects with the API's error when the server refuses it, which
 * drops it from the queue.
 */
export const saveMyAvatar = async (userId: string, choice: AvatarChoice): Promise<"saved" | "pending"> => {
  writes++;
  writeStored(pendingKey(userId), choice);
  publish();
  const sent = await withTimeout(sendPending(userId), NETWORK_ANSWER_MS, (): Sent => ({
    outcome: "pending",
  }));
  if (sent.outcome === "refused") throw sent.error;
  return sent.outcome;
};

/** Forget the choice and its queue on this device (sign-out). */
export const forgetMyAvatar = () => {
  writes++;
  forgotten++;
  sending.clear();
  asked.clear();
  snapshots.clear();
  unstored.clear();
  try {
    for (const key of Object.keys(localStorage))
      if ([CACHE_PREFIX, PENDING_PREFIX, SENT_PREFIX].some((prefix) => key.startsWith(prefix)))
        localStorage.removeItem(key);
  } catch {
    // Nothing stored.
  }
  publish();
};
