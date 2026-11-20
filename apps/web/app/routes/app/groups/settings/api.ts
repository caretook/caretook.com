import type { ShouldRevalidateFunctionArgs } from "react-router";
import type { ActionResult } from "~/lib/core/api";

import { load, toActionResult } from "~/lib/core/api";
import { rpc } from "~/lib/core/rpc";
import { NEEDS_CONNECTION } from "./groupSettings";

// How the group's settings subpages (`details`, `members`) talk to the
// server. Names, members and roles come from the device's local copy; the
// date of birth doesn't sync, so it comes from the API, and every change
// goes through the API too: online only.

/** fetch fails with a TypeError when there's no connection. */
const isNetworkError = (e: unknown) => e instanceof TypeError;

/**
 * The recipient's profile from the API. Without a connection the page still
 * loads, read-only (`online: false`, no profile).
 */
export const loadRecipientProfile = (request: Request, groupId: string) =>
  load(request, rpc.careGroup.recipient({ groupId })).then(
    (recipient) => ({ online: true as const, recipient }),
    (e: unknown) => {
      if (isNetworkError(e)) return { online: false as const, recipient: null };
      throw e;
    },
  );

/**
 * What a save that threw says: "Needs a connection" without one, `refusal`'s
 * message when it has one for the error, else the API's error.
 */
export const failedSave = (e: unknown, refusal?: (e: unknown) => string | null): ActionResult => {
  if (isNetworkError(e)) return { ok: false, error: NEEDS_CONNECTION, issues: [] };
  const refused = refusal?.(e);
  if (refused) return { ok: false, error: refused, issues: [] };
  return toActionResult(e);
};

/** A save that was refused changed nothing, so there's nothing to load again. */
export function shouldRevalidate({ actionResult, defaultShouldRevalidate }: ShouldRevalidateFunctionArgs) {
  const result = actionResult as ActionResult | undefined;
  if (result && !result.ok) return false;
  return defaultShouldRevalidate;
}
