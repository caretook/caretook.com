import type { AppError } from "@caretook/data";

import { ORPCError } from "@orpc/server";
import { ERRORS, isError } from "@caretook/data";

const ORPC_CODES: Record<number, string> = {
  400: "BAD_REQUEST",
  401: "UNAUTHORIZED",
  403: "FORBIDDEN",
  404: "NOT_FOUND",
  409: "CONFLICT",
};

/** Data that's safe to show a client: only validation issues, never db details. */
const publicMeta = (error: AppError) => {
  const issues = (error.meta as { issues?: unknown } | undefined)?.issues;
  return issues ? { issues } : undefined;
};

/**
 * An AppError as an oRPC error. 4xx codes carry our error code and message
 * (they're written for users). Anything else is a 500 with a generic
 * message, carrying the AppError as its `cause` (never sent to the client)
 * so `logFailures` (procedures.ts) can log its code with the procedure.
 */
export const toORPCError = (error: AppError) => {
  const status = (ERRORS[error.code] as { statusCode?: number }).statusCode ?? 500;
  const code = ORPC_CODES[status];
  if (!code) {
    return new ORPCError("INTERNAL_SERVER_ERROR", { message: "Something went wrong", cause: error });
  }
  return new ORPCError(code, {
    status,
    message: error.message,
    data: { code: error.code, ...publicMeta(error) },
  });
};

/** Return the value, or throw the AppError as an oRPC error. */
export const unwrap = <T>(value: T): Exclude<T, AppError> => {
  if (isError(value)) throw toORPCError(value);
  return value as Exclude<T, AppError>;
};
