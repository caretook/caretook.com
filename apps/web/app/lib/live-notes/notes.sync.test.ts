import type { SyncDb } from "../sync/index";

import { buildNoteDoc, fromBase64 } from "@caretook/data/schema";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as Y from "yjs";
import { bindNoteDoc } from "./notes.sync";

type Row = { id: string; data: string };

/** A local database: `failNext()` makes the next note_update insert throw. */
const fakeDb = () => {
  const rows: Row[] = [];
  const failures: boolean[] = [];
  const db = {
    userId: "u1",
    drizzle: {
      insert: () => ({
        values: (row: Row) =>
          failures.shift() ? Promise.reject(new Error("disk full")) : (rows.push(row), Promise.resolve()),
      }),
    },
    powersync: { watch: () => undefined },
  } as unknown as SyncDb;
  return { db, rows, failNext: () => failures.push(true) };
};

const type = (doc: Y.Doc, text: string) => {
  const t = doc.getText("t");
  t.insert(t.length, text);
};

const textOf = (rows: Row[]) => {
  const doc = buildNoteDoc(
    null,
    rows.map((r) => r.data),
  );
  const text = doc.getText("t").toString();
  doc.destroy();
  return text;
};

/** Each row's clock range for the one typing client: `[from, to)`. */
const ranges = (rows: Row[], client: number) =>
  rows.map((r) => {
    const meta = Y.parseUpdateMeta(fromBase64(r.data));
    return [meta.from.get(client), meta.to.get(client)];
  });

describe("bindNoteDoc", () => {
  afterEach(() => vi.restoreAllMocks());

  it("keeps a burst whose insert failed and writes it with the next flush, once", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { db, rows, failNext } = fakeDb();
    const doc = new Y.Doc();
    const { flush, unbind } = bindNoteDoc(doc, { db, documentId: "d1", groupId: "g1", canWrite: true });

    type(doc, "Hello");
    await flush();
    expect(rows).toHaveLength(1);

    type(doc, ", world");
    failNext();
    await flush();
    expect(rows).toHaveLength(1);

    type(doc, "!");
    await flush();
    expect(rows).toHaveLength(2);
    expect(textOf(rows)).toBe("Hello, world!");
    // No overlap: the retried row starts where the first one ended.
    const [[, firstEnd], [secondStart]] = ranges(rows, doc.clientID);
    expect(secondStart).toBe(firstEnd);

    await flush();
    expect(rows).toHaveLength(2);
    unbind();
    doc.destroy();
  });

  it("retries a first insert that throws", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { db, rows, failNext } = fakeDb();
    const doc = new Y.Doc();
    const { flush, unbind } = bindNoteDoc(doc, { db, documentId: "d1", groupId: "g1", canWrite: true });

    type(doc, "Took her pills at 8");
    failNext();
    await flush();
    expect(rows).toHaveLength(0);
    await flush();
    expect(rows).toHaveLength(1);
    expect(textOf(rows)).toBe("Took her pills at 8");
    unbind();
    doc.destroy();
  });
});
