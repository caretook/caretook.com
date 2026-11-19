// /admin/users's search lives in the URL (?q=&page=), so a search can be
// reloaded and shared. A page that isn't a positive whole number is the
// first. The API checks again (accountSearchZSchema). Pure, tested.

export const MAX_QUERY = 254;

/** The search text and page in `search`. */
export const parseUserSearch = (search: string | URLSearchParams): { q: string; page: number } => {
  const params = typeof search === "string" ? new URLSearchParams(search) : search;
  const q = (params.get("q") ?? "").trim().replace(/\s+/g, " ").slice(0, MAX_QUERY);
  const page = Number(params.get("page"));
  return { q, page: Number.isInteger(page) && page > 1 && page <= 100_000 ? page : 1 };
};

/** The query string for `q` and `page` ("" for everything on the first page). */
export const userSearch = (q: string, page = 1) => {
  const params = new URLSearchParams();
  if (q.trim()) params.set("q", q.trim());
  if (page > 1) params.set("page", String(page));
  const text = params.toString();
  return text ? `?${text}` : "";
};

/** How many pages `count` accounts fill. */
export const userPageCount = (count: number, pageSize: number) => Math.max(1, Math.ceil(count / pageSize));
