import { isError } from "./errors";

// Server logs are a copy of what we print, kept by the host (a vendor), so
// they carry codes and ids only, never care data (security review S-8).
//
// For an AppError: its code, never its message (callers can pass one built
// from values), `meta` (it holds the failing values and validation issues)
// or `cause`'s message. For anything else (a pg error, a thrown Error): the
// class name, a code when it's a constant (`23505`, `ECONNREFUSED`), and the
// stack frames without the first line, because messages carry values (pg's
// "Key (email)=(…) already exists"). Frames are file paths and function
// names, which are ours.

/** What a log line may say besides the error. Ids only, never values. */
export type LogFields = {
  /** The oRPC procedure, as its path (`careGroup.create`). */
  procedure?: string;
  /** The signed-in user's id. */
  actorId?: string | null;
  /** The care group the request was about, when known. */
  groupId?: string | null;
  /** The row the work was on (an outbox row, a document). */
  recordId?: string | null;
  /** A notification's registry name (`magicLink`), never its data. */
  notification?: string;
  attempts?: number;
};

const FIELD_KEYS: Record<keyof LogFields, string> = {
  procedure: "procedure",
  actorId: "actor",
  groupId: "group",
  recordId: "id",
  notification: "notification",
  attempts: "attempts",
};

const MAX_FRAMES = 8;
const MAX_CAUSES = 3;

/** A constant-looking code (SQLSTATE, errno names), never free text. */
const SAFE_CODE = /^[A-Z0-9_]{1,40}$/;

const className = (error: unknown) => {
  if (error === null) return "null";
  if (typeof error !== "object") return typeof error;
  const name = (error as { constructor?: { name?: unknown } }).constructor?.name;
  return typeof name === "string" && name ? name : "Object";
};

/** Stack frames only: the `at …` lines, never the message line(s) above them. */
const framesOf = (error: unknown) => {
  const stack = error instanceof Error ? error.stack : undefined;
  if (!stack) return [];
  return stack
    .split("\n")
    .filter((line) => /^\s+at /.test(line))
    .slice(0, MAX_FRAMES)
    .map((line) => `    ${line.trim()}`);
};

const describeOne = (error: unknown) => {
  if (isError(error)) return `code=${String(error.code)}`;
  const code = (error as { code?: unknown } | null)?.code;
  const safe = typeof code === "string" && SAFE_CODE.test(code) ? `(${code})` : "";
  return `error=${className(error)}${safe}`;
};

/**
 * The log line for `error`: `[caretook] <event> code=… procedure=… actor=…`,
 * then causes and stack frames on the lines below. `event` must be a fixed
 * string (never built from values).
 */
export const formatErrorLog = (event: string, error: unknown, fields: LogFields = {}) => {
  const parts = [`[caretook] ${event}`, describeOne(error)];
  for (const [key, label] of Object.entries(FIELD_KEYS) as [keyof LogFields, string][]) {
    const value = fields[key];
    if (value !== undefined && value !== null && value !== "") parts.push(`${label}=${String(value)}`);
  }
  const lines = [parts.join(" "), ...framesOf(error)];
  let cause = error instanceof Error ? error.cause : undefined;
  for (let depth = 0; cause !== undefined && cause !== null && depth < MAX_CAUSES; depth++) {
    lines.push(`  caused by ${describeOne(cause)}`, ...framesOf(cause));
    cause = cause instanceof Error ? cause.cause : undefined;
  }
  return lines.join("\n");
};

/** Log `error` to the server's log with codes and ids only (see above). */
export const logError = (event: string, error: unknown, fields?: LogFields) => {
  console.error(formatErrorLog(event, error, fields));
};
