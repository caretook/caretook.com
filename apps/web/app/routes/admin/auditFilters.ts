import type { AuditAction } from "@caretook/data/schema";

import { isAuditAction } from "@caretook/data/schema";

// /admin/audit's filters live in the URL (?actor=&target=&action=&from=&to=&page=),
// so a filtered view can be reloaded and shared, and other admin pages can
// link to "everything about this account". A value that isn't valid is
// dropped, never an error. The API checks again (auditFilterZSchema).

export type AuditFilterValues = {
  actorId?: string;
  target?: string;
  action?: AuditAction;
  from?: string;
  to?: string;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const isDay = (value: string) => DAY.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));

/** The URL parameter for each filter. */
const PARAMS = { actorId: "actor", target: "target", action: "action", from: "from", to: "to" } as const;

/** The filters and page in `search`. */
export const parseAuditSearch = (
  search: string | URLSearchParams,
): { filter: AuditFilterValues; page: number } => {
  const params = typeof search === "string" ? new URLSearchParams(search) : search;
  const get = (name: string) => params.get(name)?.trim() ?? "";
  const filter: AuditFilterValues = {};
  const actor = get(PARAMS.actorId);
  const target = get(PARAMS.target).slice(0, 254);
  const action = get(PARAMS.action);
  const from = get(PARAMS.from);
  const to = get(PARAMS.to);
  if (UUID.test(actor)) filter.actorId = actor.toLowerCase();
  if (target) filter.target = target;
  if (isAuditAction(action)) filter.action = action;
  if (isDay(from)) filter.from = from;
  if (isDay(to)) filter.to = to;
  const page = Number(get("page"));
  return { filter, page: Number.isInteger(page) && page >= 1 ? page : 1 };
};

/** The query string ("?…", or "" for none) for `filter` and `page` (page 1 is left out). */
export const auditSearch = (filter: AuditFilterValues, page = 1) => {
  const params = new URLSearchParams();
  for (const key of ["actorId", "target", "action", "from", "to"] as const) {
    const value = filter[key];
    if (value) params.set(PARAMS[key], value);
  }
  if (page > 1) params.set("page", String(page));
  const text = params.toString();
  return text ? `?${text}` : "";
};

/** Whether any filter is set. */
export const hasAuditFilters = (filter: AuditFilterValues) => Object.values(filter).some(Boolean);

/** How many pages `count` rows take at `pageSize` a page (at least 1). */
export const auditPageCount = (count: number, pageSize: number) => Math.max(1, Math.ceil(count / pageSize));
