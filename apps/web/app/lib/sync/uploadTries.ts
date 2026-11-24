// The upload's try counter (sync-safety, B-286): how often the server has
// answered `failed` for the op at the head of the queue, and since when. The
// uploader sets an op aside after `SET_ASIDE_TRIES` tries spread over at least
// `SET_ASIDE_SPAN_MS`, so a server fault on one change never holds the rest
// of the queue, while a short blip never sets anything aside. Only one op
// fails at a time (the server stops there), so one record is kept: a
// different op starts over. A request that fails as a whole never comes here.
// The record is kept in localStorage so it survives a reload; it holds queue
// ids and times only, never care data.

export const SET_ASIDE_TRIES = 5;
export const SET_ASIDE_SPAN_MS = 2 * 60_000;

/** The failing op's tries: `key` names the queue entry, `first` and `last` are epoch ms. */
export type TryRecord = { key: string; count: number; first: number; last: number };

/** A queue entry's key: PowerSync's client id plus the op's table and row (ids restart after a wipe). */
export const tryKey = (entry: { clientId: number; table: string; id: string }) =>
  `${entry.clientId}:${entry.table}:${entry.id}`;

/** The record after one more failed try of `key` at `now`. */
export const addTry = (record: TryRecord | null, key: string, now: number): TryRecord =>
  record?.key === key
    ? { ...record, count: record.count + 1, last: now }
    : { key, count: 1, first: now, last: now };

/** Whether the op has failed often enough, for long enough, to be set aside. */
export const shouldSetAside = (record: TryRecord) =>
  record.count >= SET_ASIDE_TRIES && record.last - record.first >= SET_ASIDE_SPAN_MS;

/** Where the record lives: localStorage on a device, a variable in a test. */
export type TryStore = { read(): string | null; write(value: string | null): void };

const parse = (raw: string | null): TryRecord | null => {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<TryRecord> | null;
    return typeof value?.key === "string" &&
      typeof value.count === "number" &&
      typeof value.first === "number" &&
      typeof value.last === "number"
      ? (value as TryRecord)
      : null;
  } catch {
    return null;
  }
};

export type TryCounter = {
  /** Count a failed try of `key`; true when the op should now be set aside. */
  fail(key: string, now: number): boolean;
  /** The ops with these keys left the queue: forget their tries. */
  acknowledged(keys: readonly string[]): void;
};

export const tryCounter = (store: TryStore): TryCounter => ({
  fail(key, now) {
    const record = addTry(parse(store.read()), key, now);
    store.write(JSON.stringify(record));
    return shouldSetAside(record);
  },
  acknowledged(keys) {
    const record = parse(store.read());
    if (record && keys.includes(record.key)) store.write(null);
  },
});

const STORAGE_KEY = "caretook:upload-tries";

/** The device's store. Without storage the count lives only as long as the page. */
export const localTryStore = (): TryStore => {
  let memory: string | null = null;
  return {
    read() {
      try {
        return localStorage.getItem(STORAGE_KEY);
      } catch {
        return memory;
      }
    },
    write(value) {
      memory = value;
      try {
        if (value === null) localStorage.removeItem(STORAGE_KEY);
        else localStorage.setItem(STORAGE_KEY, value);
      } catch {
        // Kept in memory instead.
      }
    },
  };
};
