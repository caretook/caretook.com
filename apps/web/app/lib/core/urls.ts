// What every area's url builders (`lib/<area>/urls.ts`) share; `appUrls`
// (lib/app-shell/appUrls.ts) composes the areas' builders into one object.
// No React or router here.

/** A search to carry onto a path. */
export type Search = string | URLSearchParams | Record<string, string | null | undefined>;

/** An id as a path segment. */
export const segment = (value: string) => encodeURIComponent(value);

/** `?a=1&b=2`, or "" when there's nothing to carry. */
export const searchString = (search?: Search): string => {
  if (!search) return "";
  const source =
    typeof search === "string" || search instanceof URLSearchParams
      ? new URLSearchParams(search)
      : new URLSearchParams(Object.entries(search).filter((pair): pair is [string, string] => !!pair[1]));
  const out = new URLSearchParams();
  for (const [key, value] of source) if (value !== "") out.append(key, value);
  const text = out.toString();
  return text ? `?${text}` : "";
};

/** `/app`, the root of every path inside the app. */
export const HOME = "/app";

/** A care group on its own (it goes on to the timeline). */
export const groupHome = (groupId: string) => `${HOME}/groups/${segment(groupId)}`;
