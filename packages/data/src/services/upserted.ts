import type { AppError } from "../errors";
import type { Upserted } from "./types";

import { isError } from "../errors";

/** A create's result as an upsert's: the new row, or the create's error. */
export const asCreated = <T>(res: T | AppError): Upserted<T> | AppError =>
  isError(res) ? res : { created: true, row: res };

/** An existing row a PUT leaves as it was. */
export const unchanged = <T>(row: T): Upserted<T> => ({ created: false, row });
