// What a device edit actually changed. PowerSync queues a PATCH with every
// column whose stored text differs from the new text, so a JSON column
// rewritten in another text form (Postgres sends `{"a": 1}`, JSON.stringify
// writes `{"a":1}`) would be re-sent unchanged and overwrite a co-member's
// newer value on the server. Edits write only what this helper returns.

const parsed = (value: unknown): unknown => {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * Whether two JSON values are equal as the server stores them (jsonb): key
 * order doesn't count, array order does, and a key set to null is not the
 * same as a missing key. A key set to `undefined` is missing, as
 * `JSON.stringify` writes it.
 */
export const sameJsonValue = (a: unknown, b: unknown): boolean => {
  if (Array.isArray(a) || Array.isArray(b)) {
    return (
      Array.isArray(a) &&
      Array.isArray(b) &&
      a.length === b.length &&
      a.every((item, i) => sameJsonValue(item, b[i]))
    );
  }
  if (isObject(a) || isObject(b)) {
    if (!isObject(a) || !isObject(b)) return false;
    const keys = (o: Record<string, unknown>) => Object.keys(o).filter((k) => o[k] !== undefined);
    const aKeys = keys(a);
    const bKeys = new Set(keys(b));
    return aKeys.length === bKeys.size && aKeys.every((k) => bKeys.has(k) && sameJsonValue(a[k], b[k]));
  }
  return a === b;
};

/**
 * Whether two JSON columns hold the same value. Each side is the column's
 * text in any form (a string is always read as JSON text), or null.
 */
export const sameJson = (a: unknown, b: unknown) => sameJsonValue(parsed(a), parsed(b));

/**
 * The columns of `next` whose value differs from `stored`'s, for an UPDATE's
 * `set`: an edit that changes nothing gets `{}`. The `json` columns are
 * compared by value ({@link sameJson}), the rest strictly.
 */
export const changedColumns = <T extends Record<string, unknown>>(
  stored: Partial<Record<keyof T, unknown>>,
  next: T,
  json: readonly (keyof T)[] = [],
): Partial<T> =>
  Object.fromEntries(
    Object.entries(next).filter(([key, value]) =>
      json.includes(key) ? !sameJson(stored[key], value) : stored[key] !== value,
    ),
  ) as Partial<T>;
