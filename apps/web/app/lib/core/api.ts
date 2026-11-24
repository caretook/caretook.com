import { ORPCError } from "@orpc/client";
import { data, redirect } from "react-router";
import { signInUrl } from "./redirect";

export type FieldIssue = { path: string; message: string };
export type ActionResult = { ok: true } | { ok: false; error: string; issues: FieldIssue[] };
/** An action that adds a row: a save gives its id, so the sheet can open what it made. */
export type CreateResult = { ok: true; id: string } | Extract<ActionResult, { ok: false }>;

/**
 * Await an API call in a clientLoader. A lost session goes to sign-in;
 * missing or forbidden data is a 404 (don't reveal that it exists).
 */
export const load = async <T>(request: Request, call: Promise<T>): Promise<T> => {
  try {
    return await call;
  } catch (e) {
    if (e instanceof ORPCError) {
      if (e.code === "UNAUTHORIZED") throw redirect(signInUrl(request));
      if (e.code === "NOT_FOUND" || e.code === "FORBIDDEN") throw data("Not found", { status: 404 });
    }
    throw e;
  }
};

/**
 * Issues arrive in two shapes: our services send `path: "details.name"`,
 * while oRPC's input validation sends Standard Schema paths
 * (`["details", "name"]`, or `[{ key: "details" }, …]`). Both become "details.name".
 */
const issuePath = (path: unknown): string => {
  if (typeof path === "string") return path;
  if (!Array.isArray(path)) return "";
  return path
    .map((part: unknown) =>
      typeof part === "object" && part !== null && "key" in part ? String(part.key) : String(part),
    )
    .join(".");
};

/** An API error as something a form can show. Anything unexpected still throws. */
export const toActionResult = (e: unknown): ActionResult => {
  if (!(e instanceof ORPCError)) throw e;
  const raw = (e.data as { issues?: { path?: unknown; message?: unknown }[] } | undefined)?.issues ?? [];
  const issues = raw.map((i) => ({
    path: issuePath(i.path),
    message: typeof i.message === "string" ? i.message : "",
  }));
  const message =
    e.code === "FORBIDDEN"
      ? "You don't have permission to do that."
      : e.code === "UNAUTHORIZED"
        ? "Your session ended. Sign in again."
        : e.message;
  return { ok: false, error: message, issues };
};
