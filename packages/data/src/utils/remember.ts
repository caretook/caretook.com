const STORE_KEY = Symbol.for("caretook.remember");

type RememberGlobal = typeof globalThis & { [STORE_KEY]?: Map<string, unknown> };

/**
 * Keep one instance of a value per process, across dev-server HMR reloads
 * (so we don't open a new connection pool on every file save).
 */
export const remember = <T>(name: string, getValue: () => T): T => {
  const g = globalThis as RememberGlobal;
  const store = (g[STORE_KEY] ??= new Map());
  if (!store.has(name)) store.set(name, getValue());
  return store.get(name) as T;
};

export const forget = (name: string) => {
  (globalThis as RememberGlobal)[STORE_KEY]?.delete(name);
};
