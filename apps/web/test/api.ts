import { ERRORS } from "@caretook/data/errors";

// The server's answers for a test device's `api` handlers (renderWithDevice):
// a refusal as oRPC sends one, and a recorder for the calls a screen makes.
//
//   const calls = apiCalls();
//   renderWithDevice({ api: { "careGroup.changeRole": calls.answer(() => refusal("careGroupMemberService:lastOwner")) } });
//   expect(calls.of("careGroup.changeRole")).toEqual([{ groupId, userId, role: "viewer" }]);

const ORPC_CODES: Record<number, string> = {
  400: "BAD_REQUEST",
  401: "UNAUTHORIZED",
  403: "FORBIDDEN",
  404: "NOT_FOUND",
  409: "CONFLICT",
};

type ErrorCode = keyof typeof ERRORS;

/** An AppError's refusal as the API sends it (`toORPCError` in packages/api): its status, message and code. */
export const refusal = (code: ErrorCode) => {
  const { message, statusCode } = ERRORS[code] as { message: string; statusCode?: number };
  const status = statusCode ?? 500;
  return Response.json(
    {
      json: {
        defined: false,
        code: ORPC_CODES[status] ?? "INTERNAL_SERVER_ERROR",
        status,
        message,
        data: { code },
      },
      meta: [],
    },
    { status },
  );
};

/** Records every call by procedure; `answer` wraps a handler so its calls are recorded. */
export const apiCalls = () => {
  const calls: { path: string; input: unknown }[] = [];
  return {
    calls,
    /** Handlers that record their calls: `{ path: handler }` in, the same out. */
    record: (handlers: Record<string, (input: unknown) => unknown>) =>
      Object.fromEntries(
        Object.entries(handlers).map(([path, handler]) => [
          path,
          (input: unknown) => {
            calls.push({ path, input });
            return handler(input);
          },
        ]),
      ),
    /** The inputs of every call to one procedure, in order. */
    of: (path: string) => calls.filter((c) => c.path === path).map((c) => c.input),
  };
};
