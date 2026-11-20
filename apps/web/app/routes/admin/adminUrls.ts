// Paths inside /admin (web only), built in one place like `appUrls`.
export const adminUrls = {
  home: () => "/admin",
  /** `search` is a query string ("?…" or ""). */
  users: (search = "") => `/admin/users${search}`,
  user: (id: string) => `/admin/users/${encodeURIComponent(id)}`,
  /** `search` is a query string ("?…" or ""). */
  groups: (search = "") => `/admin/groups${search}`,
  group: (id: string) => `/admin/groups/${encodeURIComponent(id)}`,
  accessCodes: () => "/admin/access-codes",
  printAccessCode: (id: string) => `/admin/access-codes/${encodeURIComponent(id)}/print`,
  newGroup: () => "/admin/new-group",
  /** `search` is a query string from `waitlistSearch` ("?…" or ""). */
  waitlist: (search = "") => `/admin/waitlist${search}`,
  waitlistExport: (search = "") => `/admin/waitlist/export${search}`,
  /** `search` is a query string from `auditSearch` ("?…" or ""). */
  audit: (search = "") => `/admin/audit${search}`,
  settings: () => "/admin/settings",
};
