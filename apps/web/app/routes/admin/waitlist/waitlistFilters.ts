import type { CaringFor } from "@caretook/data/domain";
import { CARING_FOR } from "@caretook/data/domain";

// /admin/waitlist's filters live in the URL (?from=&to=&caringFor=&source=&page=),
// so a filtered view can be reloaded, shared between staff and exported. A
// value that isn't valid is dropped, never an error: the page shows every
// entry instead. The API checks again (waitlistFilterZSchema).

export type WaitlistFilterValues = {
  from?: string;
  to?: string;
  caringFor?: CaringFor | "none";
  source?: string;
};

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const isDay = (value: string) => DAY.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
const CARING_FOR_VALUES: readonly string[] = [...CARING_FOR, "none"];

/** The filters and page in `search`. */
export const parseWaitlistSearch = (
  search: string | URLSearchParams,
): { filter: WaitlistFilterValues; page: number } => {
  const params = typeof search === "string" ? new URLSearchParams(search) : search;
  const get = (name: string) => params.get(name)?.trim() ?? "";
  const filter: WaitlistFilterValues = {};
  const from = get("from");
  const to = get("to");
  const caringFor = get("caringFor");
  const source = get("source").slice(0, 200);
  if (isDay(from)) filter.from = from;
  if (isDay(to)) filter.to = to;
  if (CARING_FOR_VALUES.includes(caringFor))
    filter.caringFor = caringFor as WaitlistFilterValues["caringFor"];
  if (source) filter.source = source;
  const page = Number(get("page"));
  return { filter, page: Number.isInteger(page) && page >= 1 ? page : 1 };
};

/** The query string ("?…", or "" for none) for `filter` and `page` (page 1 is left out). */
export const waitlistSearch = (filter: WaitlistFilterValues, page = 1) => {
  const params = new URLSearchParams();
  for (const key of ["from", "to", "caringFor", "source"] as const) {
    const value = filter[key];
    if (value) params.set(key, value);
  }
  if (page > 1) params.set("page", String(page));
  const text = params.toString();
  return text ? `?${text}` : "";
};

/** Whether any filter is set. */
export const hasFilters = (filter: WaitlistFilterValues) => Object.values(filter).some(Boolean);

/** How many pages `count` rows take at `pageSize` a page (at least 1). */
export const pageCount = (count: number, pageSize: number) => Math.max(1, Math.ceil(count / pageSize));
