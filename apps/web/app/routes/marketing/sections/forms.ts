import type { WaitlistSource } from "@caretook/data/schema";

import { UTM_PARAMS } from "@caretook/data/schema";

// Pure helpers for the marketing site's public forms (the waitlist and
// contact). The form components are in PublicForm.tsx.

/** What a form shows after a failed submit: a line for the form, and one per field. */
export type FormFailure = { message: string; fields: Record<string, string> };

export const FORM_MESSAGES = {
  invalid: "Check the highlighted fields and try again.",
  tooMany: "That's a lot of tries in a row. Wait a minute, then send it again.",
  offline: "Couldn't reach Caretook. Check your connection and try again.",
  failed: "Something went wrong on our side. Try again in a moment.",
} as const;

/**
 * An issue's path as one field name. oRPC's input validation sends Standard
 * Schema paths (`["email"]` or `[{ key: "email" }]`); our services send "email".
 */
const pathOf = (path: unknown): string => {
  if (typeof path === "string") return path;
  if (!Array.isArray(path)) return "";
  return path
    .map((part: unknown) =>
      typeof part === "object" && part !== null && "key" in part ? String(part.key) : String(part),
    )
    .join(".");
};

/** The first message for each field, from an error's issues. */
export const fieldErrors = (
  issues: readonly { path?: unknown; message?: unknown }[],
): Record<string, string> => {
  const fields: Record<string, string> = {};
  for (const issue of issues) {
    const path = pathOf(issue.path);
    if (path && typeof issue.message === "string" && !(path in fields)) fields[path] = issue.message;
  }
  return fields;
};

/**
 * A failed submit as what the form shows. `error` is what the API call
 * threw: an oRPC error (a `code`, and issues in `data`), or a network
 * failure (a `TypeError` from fetch).
 */
export const formFailure = (error: unknown): FormFailure => {
  if (error instanceof TypeError) return { message: FORM_MESSAGES.offline, fields: {} };
  const code = typeof error === "object" && error !== null && "code" in error ? String(error.code) : "";
  if (code === "TOO_MANY_REQUESTS") return { message: FORM_MESSAGES.tooMany, fields: {} };
  if (code === "BAD_REQUEST") {
    const data = (error as { data?: { issues?: { path?: unknown; message?: unknown }[] } }).data;
    return { message: FORM_MESSAGES.invalid, fields: fieldErrors(data?.issues ?? []) };
  }
  return { message: FORM_MESSAGES.failed, fields: {} };
};

/**
 * Where someone joined the waitlist from: the page's path, and the UTM
 * parameters in its query (`utm_source` → `utmSource`). Others are dropped.
 */
export const waitlistSource = (pathname: string, search: string): WaitlistSource => {
  const params = new URLSearchParams(search);
  const source: WaitlistSource = { page: pathname.slice(0, 200) };
  for (const [param, key] of Object.entries(UTM_PARAMS)) {
    const value = params.get(param)?.trim();
    if (value) source[key] = value.slice(0, 200);
  }
  return source;
};
