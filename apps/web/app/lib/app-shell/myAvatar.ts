import type { AvatarChoice } from "@caretook/data/schema";

import { NO_AVATAR_CHOICE, readAvatarChoice } from "@caretook/data/schema";
import { useEffect, useSyncExternalStore } from "react";
import { rpc } from "../core/rpc";

// The signed-in member's own avatar choice, for the header and the picker. It
// lives on `user`, whose synced row a member with no group doesn't have, so it's
// read from `me.get` once per page load and kept here. Saving needs a
// connection. It never goes through `updatePreferences`.

const choices = new Map<string, AvatarChoice>();
const asked = new Set<string>();
const listeners = new Set<() => void>();
/** Bumped by every save and by sign-out: an answer from before one is stale. */
let writes = 0;

const publish = (userId: string, choice: AvatarChoice) => {
  choices.set(userId, choice);
  for (const listener of listeners) listener();
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const refresh = async (userId: string) => {
  if (asked.has(userId)) return;
  asked.add(userId);
  const since = writes;
  try {
    const me = await rpc.me.get();
    if (since === writes) publish(userId, readAvatarChoice(me.avatar));
  } catch {
    // Offline or signed out: the next screen to mount asks again.
    asked.delete(userId);
  }
};

/** The member's choice, live; the default until the server has answered. */
export const useMyAvatar = (userId: string): AvatarChoice => {
  useEffect(() => {
    void refresh(userId);
  }, [userId]);
  return useSyncExternalStore(
    subscribe,
    () => choices.get(userId) ?? NO_AVATAR_CHOICE,
    () => NO_AVATAR_CHOICE,
  );
};

/** Send a whole choice (null clears a field). Rejects when the server doesn't take it. */
export const saveMyAvatar = async (userId: string, choice: AvatarChoice) => {
  const since = ++writes;
  try {
    const { avatar } = await rpc.me.setAvatar(choice);
    // Signed out, or saved again, meanwhile: this answer is no longer the latest.
    if (since === writes) publish(userId, readAvatarChoice(avatar));
  } catch (e) {
    asked.delete(userId);
    throw e;
  }
};

/** Forget the choice on this device (sign-out). */
export const forgetMyAvatar = () => {
  writes++;
  choices.clear();
  asked.clear();
  for (const listener of listeners) listener();
};
