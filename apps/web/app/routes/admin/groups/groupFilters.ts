// /admin/groups' filters live in the URL (?q=&noOwner=1&page=), so a search
// can be reloaded and shared. A value that isn't valid is dropped, never an
// error; the API checks again. Pure, tested.

export type GroupFilterValues = {
  /** Part of the group's name, or its recipient's name or preferred name. */
  q?: string;
  /** Only groups with no owner. */
  noOwner?: boolean;
};

/** The longest search the API takes. */
export const GROUP_QUERY_MAX = 120;

/** The filters and page in `search`. */
export const parseGroupSearch = (
  search: string | URLSearchParams,
): { filter: GroupFilterValues; page: number } => {
  const params = typeof search === "string" ? new URLSearchParams(search) : search;
  const filter: GroupFilterValues = {};
  const q = (params.get("q") ?? "").trim().replace(/\s+/g, " ").slice(0, GROUP_QUERY_MAX).trim();
  if (q) filter.q = q;
  if (["1", "true", "on"].includes(params.get("noOwner") ?? "")) filter.noOwner = true;
  const page = Number(params.get("page") ?? "");
  return { filter, page: Number.isInteger(page) && page >= 1 ? page : 1 };
};

/** The query string ("?…", or "" for none) for `filter` and `page` (page 1 is left out). */
export const groupSearch = (filter: GroupFilterValues, page = 1) => {
  const params = new URLSearchParams();
  if (filter.q) params.set("q", filter.q);
  if (filter.noOwner) params.set("noOwner", "1");
  if (page > 1) params.set("page", String(page));
  const text = params.toString();
  return text ? `?${text}` : "";
};

/** Whether any filter is set. */
export const hasGroupFilters = (filter: GroupFilterValues) => !!filter.q || !!filter.noOwner;

/** How many pages `count` groups take at `pageSize` a page (at least 1). */
export const groupPageCount = (count: number, pageSize: number) => Math.max(1, Math.ceil(count / pageSize));
