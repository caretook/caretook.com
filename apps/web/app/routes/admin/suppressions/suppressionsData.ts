import type { StaffCapability, SuppressionReason } from "@caretook/data/schema";
import type { AdminActionResult } from "../adminForms";

import { adminFailure } from "../adminForms";
import { parseSuppressionSearch, suppressionPageCount } from "./suppressionSearch";

// What /admin/suppressions's loader and action do, given the API (the
// route passes `api.admin.suppressions` as the signed-in staff member; the
// component tests pass a stub). No server imports, so the tests can run it.

export type SuppressionRow = { id: string; address: string; reason: SuppressionReason; createdAt: string };

/** The slice of `admin.suppressions` the page uses. */
export type SuppressionsApi = {
  list: (input: { query?: string; page: number }) => Promise<{
    count: number;
    page: number;
    pageSize: number;
    suppressions: SuppressionRow[];
  }>;
  clear: (input: { address: string; reason: string }) => Promise<unknown>;
};

/** The page's data: the search (from the URL), one page of suppressions, and whether Clear shows. */
export const loadSuppressions = async (
  url: URL,
  api: SuppressionsApi,
  capabilities: readonly StaffCapability[],
) => {
  const { q, page } = parseSuppressionSearch(url.search);
  const result = await api.list({ ...(q ? { query: q } : {}), page });
  return {
    ...result,
    q,
    pages: suppressionPageCount(result.count, result.pageSize),
    canClear: capabilities.includes("users.help"),
  };
};

export type SuppressionsData = Awaited<ReturnType<typeof loadSuppressions>>;

const text = (form: FormData, name: string) => {
  const value = form.get(name);
  return typeof value === "string" ? value.trim() : "";
};

/** Clear the posted address's suppression, with the posted reason. */
export const clearSuppressionAction = async (
  form: FormData,
  api: SuppressionsApi,
): Promise<AdminActionResult> => {
  const address = text(form, "address");
  if (text(form, "intent") !== "clear" || !address)
    return { ok: false, error: "Something went wrong. Reload and try again.", issues: [] };
  try {
    await api.clear({ address, reason: text(form, "reason") });
    return { ok: true, message: `${address} gets email again.` };
  } catch (e) {
    return adminFailure(e);
  }
};
