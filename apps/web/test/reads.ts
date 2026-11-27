import { PowerSyncDatabase } from "@powersync/web";
import { onTestFinished, vi } from "vitest";

// What a screen reads from the device: every one-off read (`getAll`) and
// live answer (`watch`) of the queries a test names, with their parameters
// and the ids they returned. For tests that a screen reads only what it
// shows (B-313). It sits above the test device's tracking, so `settle`
// still sees the queries.

type Handler = { onResult: (result: unknown) => void; onError?: (error: unknown) => void };
type Watch = (sql: string, params: unknown[], handler: Handler, options: unknown) => unknown;
type GetAll = (sql: string, params?: unknown[]) => Promise<unknown[]>;

export type Read = { sql: string; params: unknown[]; ids: string[] };

/** The SQL with its whitespace collapsed, as `sqlPart` is matched against it. */
const one = (sql: string) => sql.replace(/\s+/g, " ").trim();
const rowIds = (rows: unknown) => ((rows ?? []) as { id: string }[]).map((r) => r.id);

/** Record every read and live answer of a query whose SQL (whitespace collapsed) contains `sqlPart`, until the test ends. */
export const recordReads = (sqlPart: string) => {
  const reads: Read[] = [];
  const proto = PowerSyncDatabase.prototype as unknown as { watch: Watch; getAll: GetAll };
  const realWatch = proto.watch;
  const realGetAll = proto.getAll;
  const watch = vi.spyOn(proto, "watch").mockImplementation(function (
    this: unknown,
    sql,
    params,
    handler,
    options,
  ) {
    if (!one(sql).includes(sqlPart)) return realWatch.call(this, sql, params, handler, options);
    const onResult = (result: unknown) => {
      const answer = result as { rows?: { _array?: unknown[] } };
      reads.push({ sql, params, ids: rowIds(answer.rows?._array) });
      handler.onResult(result);
    };
    return realWatch.call(this, sql, params, { ...handler, onResult }, options);
  });
  const getAll = vi.spyOn(proto, "getAll").mockImplementation(async function (this: unknown, sql, params) {
    const result = await realGetAll.call(this, sql, params);
    // PowerSync's own `EXPLAIN` of a watched query (which tables it reads) isn't a read of rows.
    if (one(sql).includes(sqlPart) && !/^EXPLAIN\b/i.test(sql.trim()))
      reads.push({ sql, params: params ?? [], ids: rowIds(result) });
    return result;
  });
  onTestFinished(() => {
    watch.mockRestore();
    getAll.mockRestore();
  });
  return reads;
};

/** The note previews' query (`windowDocumentsQuery`; before B-313, `groupDocumentsQuery`). */
export const PREVIEWS_SQL = "AS updates FROM note_document d WHERE d.group_id = ?";
