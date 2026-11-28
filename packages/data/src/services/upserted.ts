import type { Tx } from "../db";
import type { AppError } from "../errors";
import type { AuthUser } from "../permissions";
import type { ServiceContext, Upserted } from "./types";

import { SYSTEM_USER } from "../constants";
import { isError } from "../errors";
import { rejectError } from "../permissions";

/** A create's result as an upsert's: the new row, or the create's error. */
export const asCreated = <T>(res: T | AppError): Upserted<T> | AppError =>
  isError(res) ? res : { created: true, row: res };

/** An existing row a PUT leaves as it was. */
export const unchanged = <T>(row: T): Upserted<T> => ({ created: false, row });

/** A model's read by id, deleted rows included, as the given actor. */
type ReadById<T> = (
  id: string,
  args: { authUser: AuthUser | null; tx: Tx; includeDeleted: true },
) => Promise<T | null | AppError>;

/**
 * A PowerSync PUT: create the row with this id if there is none, else leave
 * it as it is. Existence is checked as the system (deleted rows included), so
 * an absent id runs `create`. A present one is read as the actor: one they
 * can't see is refused the same way whether or not it exists, an identity
 * field that differs gets `immutable`'s error, and anything else comes back
 * `unchanged`. Runs inside the caller's transaction.
 */
export const createIfAbsent = async <T, C>({
  ctx,
  tx,
  getById,
  id,
  create,
  immutable,
}: {
  ctx: ServiceContext;
  tx: Tx;
  getById: ReadById<T>;
  id: string;
  create: () => Promise<C | AppError>;
  immutable: (visible: T) => AppError | undefined;
}): Promise<Upserted<T> | Upserted<C> | AppError> => {
  const existing = await getById(id, { authUser: SYSTEM_USER, tx, includeDeleted: true });
  if (isError(existing)) return existing;
  if (!existing) return asCreated(await create());

  const visible = await getById(id, { authUser: ctx.authUser, tx, includeDeleted: true });
  if (isError(visible)) return visible;
  if (!visible) return rejectError(ctx.authUser);
  return immutable(visible) ?? unchanged(visible);
};
