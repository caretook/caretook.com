// What happens to the device's local copy when a session ends (sync-safety
// slice 4, B-290). Pure; unit-tested. The PRD's decisions a11 and a12:
//
// - an explicit Sign out wipes, but asks first when changes are waiting to upload;
// - a session the server ended keeps the copy for its owner only when it holds
//   changes waiting to upload (they upload at the same person's next sign-in);
//   with nothing waiting it's wiped;
// - someone else signing in always wipes it first;
// - a kept copy is wiped once it has waited `KEPT_COPY_LIMIT_MS`, the next time
//   the app opens on the device.

/** A copy kept for its owner after the session ended is wiped once it has waited this long. */
export const KEPT_COPY_LIMIT_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * - `signOut`: the person pressed Sign out.
 * - `sessionEnded`: the server says the session is gone (signed out elsewhere, expired, revoked).
 * - `otherUser`: someone else is opening the local copy.
 * - `keptCopy`: the app opens on a device holding a kept copy.
 */
export type CopyEndReason = "signOut" | "sessionEnded" | "otherUser" | "keptCopy";

/** `wipe`: clear it now. `ask`: ask the person before wiping. `keep`: keep it for its owner. */
export type CopyFate = "wipe" | "ask" | "keep";

export type CopyEnd = {
  reason: CopyEndReason;
  /** Changes waiting to upload (the upload queue). */
  waiting: number;
  /** When the copy was kept (ms), for `keptCopy`; null when unknown. */
  keptAt?: number | null;
  now?: number;
};

/** Whether a copy kept at `keptAt` has waited past its limit (the edge kept). Unknown counts as past it. */
export const keptCopyExpired = (keptAt: number | null | undefined, now: number): boolean =>
  keptAt == null || !Number.isFinite(keptAt) || now - keptAt > KEPT_COPY_LIMIT_MS;

export const localCopyFate = ({ reason, waiting, keptAt, now = Date.now() }: CopyEnd): CopyFate => {
  const unsent = waiting > 0;
  switch (reason) {
    case "signOut":
      return unsent ? "ask" : "wipe";
    case "sessionEnded":
      return unsent ? "keep" : "wipe";
    case "otherUser":
      return "wipe";
    case "keptCopy":
      return keptCopyExpired(keptAt, now) ? "wipe" : "keep";
  }
};
