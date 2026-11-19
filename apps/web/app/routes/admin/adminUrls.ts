// Paths inside /admin (web only), built in one place like `appUrls`.
export const adminUrls = {
  home: () => "/admin",
  accessCodes: () => "/admin/access-codes",
  printAccessCode: (id: string) => `/admin/access-codes/${encodeURIComponent(id)}/print`,
  newGroup: () => "/admin/new-group",
  /** `search` is a query string from `waitlistSearch` ("?…" or ""). */
  waitlist: (search = "") => `/admin/waitlist${search}`,
  waitlistExport: (search = "") => `/admin/waitlist/export${search}`,
};
