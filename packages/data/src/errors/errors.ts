import type { TSError } from "typescript-errors";

import { init } from "typescript-errors";
import { ERRORS } from "./constants";

// Errors are returned as values, not thrown. Callers narrow with isError():
//
//   const user = await userModel.getById(id, args);
//   if (isError(user)) return user;
//
// Wrap anything that can throw (db calls, third-party SDKs) in mayFail /
// promiseMayFail so it comes back as a typed error with a known code.
export const {
  isError,
  mayFail,
  newError,
  promiseMayFail,
  promiseMapMayFail,
  throwIfError,
  throwErrorResponseIfError,
} = init(ERRORS);

export type ErrorCodes = typeof ERRORS;
export type ErrorCode = keyof ErrorCodes;
export type AppError = TSError<ErrorCodes>;
