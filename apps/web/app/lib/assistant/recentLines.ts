import { useMemo, useSyncExternalStore } from "react";

// Quick entry's recent lines: the last few lines a user saved in a group on
// this device, offered again as one-tap chips that fill the box. Per device,
// user and group, in localStorage (every access may throw: private mode,
// storage disabled; then there are none). Recorded on Save only, never sent
// to the server, and forgotten at sign-out (`wipeDevice`).

const PREFIX = "caretook:recentLines:";

/** How many recent lines are kept (and offered). */
export const RECENT_LINES_MAX = 8;

const storageKey = (userId: string, groupId: string) => `${PREFIX}${userId}:${groupId}`;

/** A line as it's kept: trimmed, with runs of spaces made one. */
export const normalizeLine = (line: string) => line.trim().replace(/\s+/g, " ");

const parse = (raw: string | null): string[] => {
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return [];
    return value
      .filter((line): line is string => typeof line === "string" && line.trim() !== "")
      .slice(0, RECENT_LINES_MAX);
  } catch {
    return [];
  }
};

/** The words before a number are a vital's key ("bp", "blood sugar"); a unit or time word after one isn't. */
const GLUE = /^(mmhg|bpm|lbs?|kg|f|c|°f|°c|%|mg\/dl|mmol\/l|at|am|pm|ago)$/i;
const NUMBER = /^[<>~]?\d/;

/** A vital part's keys only: "bp 130/85 hr 72" → "bp hr". Empty when it names none. */
const vitalKeys = (text: string): string => {
  const keys: string[] = [];
  let pending: string[] = [];
  for (const word of text.replace(/^\s*v:\s*/i, "").split(/\s+/)) {
    if (NUMBER.test(word)) {
      if (pending.length) keys.push(pending.join(" "));
      pending = [];
    } else if (word && !GLUE.test(word)) pending.push(word);
  }
  return keys.join(" ");
};

type ParsedPart = { text: string; readings: readonly { kind: string }[] };

/**
 * What to remember of a saved line, given its parts as read (the reading
 * shown for each first). Nothing for a note or an event; a vital's keys only
 * ("bp hr ", with a trailing space, which both leaves the cursor ready for the
 * numbers and marks the line as reduced already); anything else as typed. A mixed line keeps its other parts and
 * the vitals' keys, and loses its notes and events. Pure.
 */
export const recentLineFor = (line: string, parsed: readonly ParsedPart[]): string => {
  const kinds = parsed.map((p) => p.readings[0]?.kind);
  if (!kinds.some((k) => k === "vital" || k === "note" || k === "event")) return normalizeLine(line);
  const pieces = parsed.flatMap((part, i) => {
    const kind = kinds[i];
    if (kind === "note" || kind === "event") return [];
    if (kind === "vital") {
      const keys = vitalKeys(part.text);
      return keys ? [{ text: keys, vital: true }] : [];
    }
    const text = normalizeLine(part.text);
    return text ? [{ text, vital: false }] : [];
  });
  if (!pieces.length) return "";
  return pieces.map((p) => p.text).join(", ") + (pieces.some((p) => p.vital) ? " " : "");
};

/** Stored lines as they're offered: each reduced by `recentLineFor` (so old notes and full vitals shrink or go), repeats merged. */
export const reduceRecentLines = (
  lines: readonly string[],
  parse: (line: string) => readonly ParsedPart[],
): string[] =>
  lines
    .reduceRight<string[]>((acc, line) => {
      // A trailing space marks a line reduced already (it has vital keys): keep it.
      const reduced = /\S\s$/.test(line) ? line : recentLineFor(line, parse(line));
      return reduced ? withRecentLine(acc, reduced) : acc;
    }, [])
    .slice(0, RECENT_LINES_MAX);

/** `line` first, then the earlier ones without it (case and spacing ignored), at most eight. Pure. */
export const withRecentLine = (recent: readonly string[], line: string): string[] => {
  // A trailing space marks a keys-only line ("bp hr "); the rest is trimmed.
  const kept = normalizeLine(line) + (/\S\s$/.test(line) ? " " : "");
  if (!kept.trim()) return [...recent];
  const key = normalizeLine(kept).toLowerCase();
  return [kept, ...recent.filter((r) => normalizeLine(r).toLowerCase() !== key)].slice(0, RECENT_LINES_MAX);
};

const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

const readRaw = (userId: string, groupId: string): string | null => {
  try {
    return localStorage.getItem(storageKey(userId, groupId));
  } catch {
    return null;
  }
};

/** `userId`'s recent lines in `groupId` on this device, newest first. */
export const recentLines = (userId: string, groupId: string): string[] => parse(readRaw(userId, groupId));

/** Record that `userId` saved `line` in `groupId`. Blank text is ignored; a repeat moves to the top. */
export const recordLine = (userId: string, groupId: string, line: string) => {
  if (!normalizeLine(line)) return;
  try {
    const next = withRecentLine(recentLines(userId, groupId), line);
    localStorage.setItem(storageKey(userId, groupId), JSON.stringify(next));
  } catch {
    // Storage unavailable: no recent lines.
  }
  notify();
};

/** Forget every user's recent lines on this device, in every group (sign-out). */
export const forgetRecentLines = () => {
  try {
    for (const key of Object.keys(localStorage)) if (key.startsWith(PREFIX)) localStorage.removeItem(key);
  } catch {
    // Nothing remembered.
  }
  notify();
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === null || e.key.startsWith(PREFIX)) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
};

const serverSnapshot = () => null;

/** `userId`'s recent lines in `groupId`, newest first, updated as lines are saved (in any tab). */
export function useRecentLines(userId: string, groupId: string): string[] {
  const raw = useSyncExternalStore(subscribe, () => readRaw(userId, groupId), serverSnapshot);
  return useMemo(() => parse(raw), [raw]);
}
