import { toActionResult } from "~/lib/core/api";

// What a refused admin action shows.

export type AdminActionResult =
  { ok: true; message: string } | { ok: false; error: string; issues: { path: string; message: string }[] };

/** An API error as a form result; anything that isn't one is rethrown. */
export const adminFailure = (e: unknown): AdminActionResult => {
  const result = toActionResult(e);
  if (result.ok) return { ok: true, message: "" };
  return { ...result, error: result.issues.length ? "Check the form and try again." : result.error };
};

export const issueFor = (result: AdminActionResult | undefined, path: string) =>
  result && !result.ok ? result.issues.find((i) => i.path === path)?.message : undefined;
