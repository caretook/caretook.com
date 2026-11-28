import type { SyncDb } from "../sync/index";
import type { SearchStore } from "./search.sync";

import { DatabaseSync } from "node:sqlite";
import { beforeEach, describe, expect, it } from "vitest";
import {
  entryMatchCondition,
  indexSearchChanges,
  prepareSearchIndex,
  SEARCH_INDEX_VERSION,
  entryRangeCondition,
  searchEntryIds,
  searchGroup,
} from "./search.sync";
import { encodeNoteDoc, noteDocFromText, parseSearch } from "@caretook/data/domain";

// The indexer against a real SQLite with FTS5, laid out the way PowerSync
// stores synced rows: `ps_data__<table>` (id, JSON data), read through a
// view per table. Rows are written to the storage tables directly, as sync
// and local writes do, so the change triggers fire as they do on a device.

const COLUMNS: Record<string, string[]> = {
  timeline_entry: [
    "group_id",
    "kind",
    "title",
    "body",
    "details",
    "place",
    "deleted_at",
    "created_by",
    "occurred_at",
  ],
  note_document: ["group_id", "snapshot", "text"],
  note_update: ["group_id", "document_id", "data"],
  user: ["name"],
  provider: ["group_id", "type", "name", "specialty", "practice_id", "phones", "deleted_at"],
  medication: ["group_id", "name", "strength", "type", "reason", "directions", "deleted_at"],
  timeline_entry_provider: ["group_id", "entry_id", "provider_id"],
  todo: ["group_id", "title", "done_at", "deleted_at"],
  recipient_condition: ["group_id", "name", "note", "status", "deleted_at"],
  medication_condition: ["group_id", "medication_id", "condition_id"],
};

const makeStore = () => {
  const sqlite = new DatabaseSync(":memory:");
  for (const [table, columns] of Object.entries(COLUMNS)) {
    sqlite.exec(`CREATE TABLE ps_data__${table} (id TEXT PRIMARY KEY, data TEXT)`);
    const select = columns.map((c) => `json_extract(data, '$.${c}') AS ${c}`).join(", ");
    sqlite.exec(`CREATE VIEW "${table}" AS SELECT id, ${select} FROM ps_data__${table}`);
  }
  const run = {
    getAll: <T>(sql: string, params: unknown[] = []) =>
      Promise.resolve(sqlite.prepare(sql).all(...(params as never[])) as T[]),
    execute: (sql: string, params: unknown[] = []) =>
      Promise.resolve(sqlite.prepare(sql).run(...(params as never[]))),
    executeBatch: (sql: string, params: unknown[][] = []) => {
      const statement = sqlite.prepare(sql);
      for (const p of params) statement.run(...(p as never[]));
      return Promise.resolve();
    },
  };
  const store: SearchStore = {
    ...run,
    writeTransaction: async (fn) => {
      sqlite.exec("BEGIN");
      try {
        const result = await fn(run);
        sqlite.exec("COMMIT");
        return result;
      } catch (e) {
        sqlite.exec("ROLLBACK");
        throw e;
      }
    },
  };
  const put = (table: string, id: string, row: Record<string, unknown>) => {
    const data = Object.fromEntries(
      Object.entries(row).map(([k, v]) => [k, v !== null && typeof v === "object" ? JSON.stringify(v) : v]),
    );
    sqlite
      .prepare(`INSERT OR REPLACE INTO ps_data__${table} (id, data) VALUES (?, ?)`)
      .run(id, JSON.stringify(data));
  };
  const remove = (table: string, id: string) =>
    sqlite.prepare(`DELETE FROM ps_data__${table} WHERE id = ?`).run(id);
  const db = { powersync: store } as unknown as SyncDb;
  return { sqlite, store, put, remove, db };
};

const G1 = "g1";
const G2 = "g2";

const seed = (s: ReturnType<typeof makeStore>) => {
  s.put("user", "u-sam", { name: "Sam Rivera" });
  s.put("user", "u-jo", { name: "Jo Kim" });
  s.put("provider", "p-practice", { group_id: G1, type: "practice", name: "Valley Heart Clinic" });
  s.put("provider", "p-patel", {
    group_id: G1,
    type: "clinician",
    name: "Dr. Anita Patel",
    specialty: "Cardiology",
    practice_id: "p-practice",
  });
  s.put("medication", "m-lis", {
    group_id: G1,
    name: "Lisinopril",
    strength: "10 mg",
    reason: "Blood pressure",
  });
  s.put("timeline_entry", "e-walk", {
    group_id: G1,
    kind: "note",
    title: "Morning",
    created_by: "u-sam",
    occurred_at: "2026-11-18T16:00:00.000000Z",
  });
  s.put("note_document", "e-walk", {
    group_id: G1,
    snapshot: encodeNoteDoc(noteDocFromText("She was walking well with José.")),
    text: "She was walking well with José.",
  });
  s.put("timeline_entry", "e-dizzy", {
    group_id: G1,
    kind: "symptom",
    details: { name: "Dizziness", severity: 3 },
    created_by: "u-jo",
    occurred_at: "2026-11-17T16:00:00.000000Z",
  });
  s.put("timeline_entry", "e-bp", {
    group_id: G1,
    kind: "vital",
    details: { readings: [{ type: "bloodPressure", systolic: 130, diastolic: 85 }] },
    created_by: "u-jo",
    occurred_at: "2026-11-16T16:00:00.000000Z",
  });
  s.put("timeline_entry", "e-dose", {
    group_id: G1,
    kind: "dose",
    details: { medicationId: "m-lis", status: "given" },
    created_by: "u-jo",
    occurred_at: "2026-11-15T16:00:00.000000Z",
  });
  s.put("timeline_entry", "e-visit", {
    group_id: G1,
    kind: "event",
    title: "Checkup",
    created_by: "u-jo",
    occurred_at: "2026-11-14T16:00:00.000000Z",
  });
  s.put("timeline_entry_provider", "l1", { group_id: G1, entry_id: "e-visit", provider_id: "p-patel" });
  // Another group's entry with the same words.
  s.put("timeline_entry", "e-other", {
    group_id: G2,
    kind: "note",
    title: "Walking and dizziness, Lisinopril",
    created_by: "u-sam",
    occurred_at: "2026-11-18T16:00:00.000000Z",
  });
};

const ids = (s: ReturnType<typeof makeStore>, text: string, groupId = G1) =>
  searchEntryIds(s.db, groupId, parseSearch(text)).then((r) => r.sort());

describe("the device search index", () => {
  let s: ReturnType<typeof makeStore>;

  beforeEach(async () => {
    s = makeStore();
    seed(s);
    await prepareSearchIndex(s.store);
  });

  it("builds the index and records its version", async () => {
    const meta = await s.store.getAll<{ value: string }>(
      `SELECT value FROM search_meta WHERE key = 'version'`,
    );
    expect(meta[0]?.value).toBe(String(SEARCH_INDEX_VERSION));
    expect(await ids(s, "morning")).toEqual(["e-walk"]);
  });

  it("finds an entry by title, note text, symptom, vital type, medication, provider and author", async () => {
    expect(await ids(s, "checkup")).toEqual(["e-visit"]);
    expect(await ids(s, "walking well")).toEqual(["e-walk"]);
    expect(await ids(s, "dizz")).toEqual(["e-dizzy"]);
    expect(await ids(s, "blood pressure")).toEqual(["e-bp"]);
    expect(await ids(s, "lisinopril")).toEqual(["e-dose"]);
    expect(await ids(s, "patel")).toEqual(["e-visit"]);
    expect(await ids(s, "sam rivera")).toEqual(["e-walk"]);
  });

  it("matches word forms, case, accents, phrases and exclusions", async () => {
    expect(await ids(s, "walked")).toEqual(["e-walk"]);
    expect(await ids(s, "JOSE")).toEqual(["e-walk"]);
    expect(await ids(s, '"walking well"')).toEqual(["e-walk"]);
    expect(await ids(s, '"well walking"')).toEqual([]);
    expect(await ids(s, "kim -dizziness")).toEqual(["e-bp", "e-dose", "e-visit"]);
  });

  it("finds a medication by its type's label", async () => {
    s.put("medication", "m-d3", { group_id: G1, name: "Vitamin D", strength: "1000 IU", type: "supplement" });
    await indexSearchChanges(s.store);
    expect((await searchGroup(s.db, G1, parseSearch("supplement"))).medication.hits.map((h) => h.id)).toEqual(
      ["m-d3"],
    );
    expect((await searchGroup(s.db, G1, parseSearch("over the counter"))).medication.total).toBe(0);
  });

  it("never returns another group's rows", async () => {
    expect(await ids(s, "walking")).toEqual(["e-walk"]);
    expect(await ids(s, "walking", G2)).toEqual(["e-other"]);
    const results = await searchGroup(s.db, G2, parseSearch("lisinopril"));
    expect(results.medication.total).toBe(0);
    expect(results.entry.hits.map((h) => h.id)).toEqual(["e-other"]);
  });

  it("follows changes: new text, pending document updates, deletes and renames", async () => {
    s.put("timeline_entry", "e-new", { group_id: G1, kind: "note", created_by: "u-sam" });
    s.put("note_document", "e-new", { group_id: G1, snapshot: null, text: null });
    // Typed on this device: only a pending update, no compacted text yet.
    s.put("note_update", "nu1", {
      group_id: G1,
      document_id: "e-new",
      data: encodeNoteDoc(noteDocFromText("Shortness of breath on the stairs")),
    });
    expect(await ids(s, "stairs")).toEqual([]);
    await indexSearchChanges(s.store);
    expect(await ids(s, "stairs")).toEqual(["e-new"]);

    // Deleted (on another device): soft delete arrives through sync.
    s.put("timeline_entry", "e-new", {
      group_id: G1,
      kind: "note",
      created_by: "u-sam",
      deleted_at: "2026-11-19",
    });
    await indexSearchChanges(s.store);
    expect(await ids(s, "stairs")).toEqual([]);

    // A provider renamed: its linked entries follow.
    s.put("provider", "p-patel", {
      group_id: G1,
      type: "clinician",
      name: "Dr. Anita Shah",
      practice_id: "p-practice",
    });
    await indexSearchChanges(s.store);
    expect(await ids(s, "patel")).toEqual([]);
    expect(await ids(s, "shah")).toEqual(["e-visit"]);

    // An author renamed, a medication renamed, a link removed.
    s.put("user", "u-sam", { name: "Samantha Rivera" });
    s.put("medication", "m-lis", { group_id: G1, name: "Lisinopril XR", strength: "10 mg" });
    s.remove("timeline_entry_provider", "l1");
    await indexSearchChanges(s.store);
    expect(await ids(s, "samantha")).toEqual(["e-walk"]);
    expect(await ids(s, "xr")).toEqual(["e-dose"]);
    expect(await ids(s, "shah")).toEqual([]);

    // Rows removed from the device (a group left) leave the index.
    s.remove("timeline_entry", "e-walk");
    await indexSearchChanges(s.store);
    expect(await ids(s, "morning")).toEqual([]);
  });

  it("groups the page's results by type, title matches first, with totals", async () => {
    s.put("timeline_entry", "e-cardio", {
      group_id: G1,
      kind: "note",
      title: "Cardiology questions",
      created_by: "u-jo",
      occurred_at: "2026-11-10T16:00:00.000000Z",
    });
    s.put("timeline_entry", "e-late", {
      group_id: G1,
      kind: "symptom",
      body: "Asked about cardiology referral",
      details: { name: "Tired" },
      created_by: "u-jo",
      occurred_at: "2026-11-18T18:00:00.000000Z",
    });
    await indexSearchChanges(s.store);
    const results = await searchGroup(s.db, G1, parseSearch("cardiology"), { entry: 1 });
    expect(results.provider.hits.map((h) => [h.id, h.titleMatch])).toEqual([["p-patel", true]]);
    expect(results.entry.total).toBe(2);
    expect(results.entry.hits.map((h) => [h.id, h.titleMatch])).toEqual([["e-cardio", true]]);
    // The medication matched in its reason (body), the providers' practice by name.
    expect((await searchGroup(s.db, G1, parseSearch("blood pressure"))).medication.hits).toMatchObject([
      { id: "m-lis", titleMatch: false },
    ]);
    expect((await searchGroup(s.db, G1, parseSearch("valley"))).provider.total).toBe(2);
  });

  it("narrows the page's results to a care period's dates: entries only, the end exclusive", async () => {
    s.put("timeline_entry", "e-cardio", {
      group_id: G1,
      kind: "note",
      title: "Cardiology questions",
      created_by: "u-jo",
      occurred_at: "2026-11-10T16:00:00.000000Z",
    });
    s.put("timeline_entry", "e-late", {
      group_id: G1,
      kind: "note",
      title: "Cardiology follow-up",
      created_by: "u-jo",
      occurred_at: "2026-11-18T18:00:00.000000Z",
    });
    await indexSearchChanges(s.store);
    const search = parseSearch("cardiology");
    const rehab = { from: "2026-11-08T18:00:00.000Z", to: "2026-11-18T18:00:00.000Z" };
    const within = await searchGroup(s.db, G1, search, {}, rehab);
    expect(within.entry.hits.map((h) => h.id)).toEqual(["e-cardio"]);
    expect(within.entry.total).toBe(1);
    // Providers and medications have no dates.
    expect(within.provider.total).toBe(0);
    const open = await searchGroup(s.db, G1, search, {}, { from: rehab.to, to: null });
    expect(open.entry.hits.map((h) => h.id)).toEqual(["e-late"]);
    expect((await searchGroup(s.db, G1, search)).entry.total).toBe(2);
  });

  it("builds the timeline's range condition in the device's timestamp form", () => {
    expect(entryRangeCondition("t.at", { from: "2026-11-08T18:00:00.000Z", to: null })).toEqual({
      sql: "t.at >= ?",
      params: ["2026-11-08T18:00:00.000000Z"],
    });
    expect(
      entryRangeCondition("t.at", { from: "2026-11-08T18:00:00.000Z", to: "2026-11-13T19:00:00.000Z" }),
    ).toEqual({
      sql: "t.at >= ? AND t.at < ?",
      params: ["2026-11-08T18:00:00.000000Z", "2026-11-13T19:00:00.000000Z"],
    });
  });

  it("indexes provider and medication notes, and leaves deleted ones out", async () => {
    s.put("note_document", "p-patel", { group_id: G1, text: "Prefers morning calls" });
    s.put("note_document", "m-lis", { group_id: G1, text: "Take with food" });
    s.put("medication", "m-old", { group_id: G1, name: "Oxybutynin", deleted_at: "2026-11-01" });
    await indexSearchChanges(s.store);
    expect((await searchGroup(s.db, G1, parseSearch("calls"))).provider.hits.map((h) => h.id)).toEqual([
      "p-patel",
    ]);
    expect((await searchGroup(s.db, G1, parseSearch("food"))).medication.hits.map((h) => h.id)).toEqual([
      "m-lis",
    ]);
    expect((await searchGroup(s.db, G1, parseSearch("oxybutynin"))).medication.total).toBe(0);
  });

  it("indexes a todo's title and notes, done ones too, follows renames and leaves deleted ones out", async () => {
    s.put("todo", "t-form", { group_id: G1, title: "Insurance form" });
    s.put("todo", "t-fax", { group_id: G1, title: "Fax the referral", done_at: "2026-11-18 10:00:00Z" });
    s.put("todo", "t-other", { group_id: G2, title: "Insurance card" });
    s.put("note_document", "t-form", { group_id: G1, text: "Ask for the claim number" });
    await indexSearchChanges(s.store);
    const todoIds = async (q: string) =>
      (await searchGroup(s.db, G1, parseSearch(q))).todo.hits.map((h) => h.id);
    expect(await todoIds("insurance")).toEqual(["t-form"]);
    expect((await searchGroup(s.db, G1, parseSearch("insurance"))).todo.hits[0]?.titleMatch).toBe(true);
    expect(await todoIds("claim")).toEqual(["t-form"]);
    expect(await todoIds("referral")).toEqual(["t-fax"]);

    s.put("todo", "t-form", { group_id: G1, title: "Benefits paperwork" });
    s.put("todo", "t-fax", { group_id: G1, title: "Fax the referral", deleted_at: "2026-11-19" });
    await indexSearchChanges(s.store);
    expect(await todoIds("insurance")).toEqual([]);
    expect(await todoIds("paperwork")).toEqual(["t-form"]);
    expect(await todoIds("referral")).toEqual([]);
  });

  it("indexes a condition's name and note, resolved ones too, follows renames and leaves deleted ones out; its changes by name", async () => {
    s.put("recipient_condition", "c-dm", { group_id: G1, name: "Type 2 diabetes", note: "Diet-controlled" });
    s.put("recipient_condition", "c-hip", { group_id: G1, name: "Hip fracture", status: "resolved" });
    s.put("recipient_condition", "c-other", { group_id: G2, name: "Diabetes" });
    s.put("timeline_entry", "e-added", {
      group_id: G1,
      kind: "conditionChange",
      details: { conditionId: "c-dm", conditionName: "Type 2 diabetes", change: "added" },
      created_by: "u-jo",
      occurred_at: "2026-11-12T16:00:00.000000Z",
    });
    await indexSearchChanges(s.store);
    const conditionIds = async (q: string) =>
      (await searchGroup(s.db, G1, parseSearch(q))).condition.hits.map((h) => h.id);
    expect(await conditionIds("diabetes")).toEqual(["c-dm"]);
    expect((await searchGroup(s.db, G1, parseSearch("diabetes"))).condition.hits[0]?.titleMatch).toBe(true);
    expect(await conditionIds("diet")).toEqual(["c-dm"]);
    expect(await conditionIds("fracture")).toEqual(["c-hip"]);
    expect(await ids(s, "diabetes")).toEqual(["e-added"]);

    s.put("recipient_condition", "c-dm", { group_id: G1, name: "Diabetes mellitus", note: null });
    s.put("recipient_condition", "c-hip", { group_id: G1, name: "Hip fracture", deleted_at: "2026-11-19" });
    await indexSearchChanges(s.store);
    expect(await conditionIds("diet")).toEqual([]);
    expect(await conditionIds("mellitus")).toEqual(["c-dm"]);
    expect(await conditionIds("fracture")).toEqual([]);
  });

  it("finds a provider by a phone number, as stored or as digits only", async () => {
    s.put("provider", "p-patel", {
      group_id: G1,
      type: "clinician",
      name: "Dr. Anita Patel",
      practice_id: "p-practice",
      phones: [{ label: "Office", number: "(555) 010-0134" }],
    });
    await indexSearchChanges(s.store);
    const providerIds = async (q: string) =>
      (await searchGroup(s.db, G1, parseSearch(q))).provider.hits.map((h) => h.id);
    expect(await providerIds("555 010 0134")).toEqual(["p-patel"]);
    expect(await providerIds("5550100134")).toEqual(["p-patel"]);
  });

  it("finds a medication by a linked condition's name, following links and renames", async () => {
    s.put("recipient_condition", "c-ht", { group_id: G1, name: "Hypertension" });
    await indexSearchChanges(s.store);
    const medicationIds = async (q: string) =>
      (await searchGroup(s.db, G1, parseSearch(q))).medication.hits.map((h) => h.id);
    expect(await medicationIds("hypertension")).toEqual([]);

    s.put("medication_condition", "mc-1", { group_id: G1, medication_id: "m-lis", condition_id: "c-ht" });
    await indexSearchChanges(s.store);
    expect(await medicationIds("hypertension")).toEqual(["m-lis"]);

    s.put("recipient_condition", "c-ht", { group_id: G1, name: "High blood pressure" });
    await indexSearchChanges(s.store);
    expect(await medicationIds("hypertension")).toEqual([]);
    expect(await medicationIds("high")).toEqual(["m-lis"]);

    s.remove("medication_condition", "mc-1");
    await indexSearchChanges(s.store);
    expect(await medicationIds("high")).toEqual([]);
  });

  it("rebuilds when the format version changes", async () => {
    await s.store.execute(`UPDATE search_meta SET value = '0' WHERE key = 'version'`);
    await s.store.execute(`DELETE FROM search_item`);
    expect(await ids(s, "morning")).toEqual([]);
    const result = await prepareSearchIndex(s.store);
    expect(result).toMatchObject({ rebuilt: true, items: 9 });
    expect(await ids(s, "morning")).toEqual(["e-walk"]);
    // Same version: nothing to rebuild.
    expect(await prepareSearchIndex(s.store)).toMatchObject({ rebuilt: false });
  });

  it("matches nothing for an empty search", async () => {
    expect(entryMatchCondition("e.id", G1, parseSearch("-walking"))).toBeNull();
    expect(await ids(s, "")).toEqual([]);
    expect((await searchGroup(s.db, G1, parseSearch(" "))).entry.total).toBe(0);
  });
});
