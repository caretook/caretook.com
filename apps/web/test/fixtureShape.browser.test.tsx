import type { Fixture } from "./fixtures";

import { describe, expect, test } from "vitest";
import { createTag } from "~/lib/tags/tags.sync";
import { renderWithDevice } from "./device";
import {
  allergy,
  condition,
  conditionChangeEntry,
  conditionManager,
  contactShare,
  entryTodo,
  fx,
  medicationCondition,
  medicationPass,
  newId,
  pgJson,
  recipientDetails,
  recordTag,
  series,
  symptomType,
  tag,
  todo,
  TEST_GROUP,
  TEST_USER,
} from "./fixtures";
import { FIXTURE_SCHEMAS, fixtureProblems, NO_FIXTURE_SCHEMA, SYNCED_TABLES } from "./fixtureShape";

// The device fixtures have the shape PowerSync delivers and pass the server's
// schemas for their tables (test/fixtureShape.ts), so component tests run on
// rows the server could have sent.

const medicationId = newId();
const conditionId = newId();
const providerId = newId();
const entryId = newId();

/** Every builder's default, by table (each timeline kind on its own). */
const DEFAULTS: Record<string, Fixture[]> = {
  care_group: [fx.group()],
  care_group_member: [fx.member({ userId: TEST_USER.id })],
  care_recipient: [fx.recipient()],
  user: [fx.user()],
  timeline_entry: [
    fx.note(),
    fx.event(),
    fx.symptom(),
    fx.vital(),
    fx.dose({ medicationId }),
    fx.medicationChange({ medicationId }),
    conditionChangeEntry({ conditionId }),
  ],
  note_document: [fx.document({ ownerId: entryId, text: "Slept well after lunch." })],
  provider: [fx.provider()],
  timeline_entry_provider: [fx.link(entryId, providerId)],
  medication: [fx.medication()],
  member_contact_share: [contactShare({ memberId: newId(), userId: TEST_USER.id })],
  care_recipient_details: [recipientDetails()],
  medication_pass: [medicationPass()],
  recipient_allergy: [allergy()],
  care_period: [fx.period()],
  todo: [todo()],
  recipient_condition: [condition()],
  medication_condition: [medicationCondition(medicationId, conditionId)],
  condition_manager: [conditionManager(conditionId, providerId)],
  appointment_series: [series()],
  symptom_type: [symptomType()],
  timeline_entry_todo: [entryTodo(entryId, newId())],
  tag: [tag()],
  record_tag: [recordTag(tag().id, entryId)],
};

/** Synced tables with a server schema but no builder, each with why. */
const NO_BUILDER: Record<string, string> = {
  note_update: "a document's Yjs updates; tests give the document's text (fx.document)",
};

const described = (f: Fixture) => `${f.table} ${typeof f.row.kind === "string" ? f.row.kind : ""}`.trim();

describe("device fixtures in the shape devices receive", () => {
  test("every synced table has a server schema, or says why not, and a default fixture", () => {
    for (const table of SYNCED_TABLES) {
      const schema = table in FIXTURE_SCHEMAS || table in NO_FIXTURE_SCHEMA;
      expect(schema, `${table}: a server schema in FIXTURE_SCHEMAS, or a reason`).toBe(true);
      expect(table in DEFAULTS || table in NO_BUILDER, `${table}: a default fixture`).toBe(true);
    }
    for (const table of [...Object.keys(FIXTURE_SCHEMAS), ...Object.keys(NO_FIXTURE_SCHEMA)])
      expect(SYNCED_TABLES, `${table} is a synced table`).toContain(table);
  });

  const withSchema = Object.values(DEFAULTS)
    .flat()
    .flatMap((f) => [f, ...(f.with ?? [])])
    .filter((f) => f.table in FIXTURE_SCHEMAS);
  test.each(withSchema.map((f) => [described(f), f] as const))("the default %s passes", (_, fixture) => {
    expect(fixtureProblems(fixture)).toEqual([]);
  });

  test("a symptom whose details the server would refuse fails", () => {
    const wrong = fx.symptom({ details: pgJson({ name: "Headache", severity: "very bad" }) });
    expect(fixtureProblems(wrong)).toEqual([expect.stringMatching(/^details\.severity: /)]);
  });

  test("a JSON column that isn't JSON text fails before the schema", () => {
    const notText = series({ providerIds: [] as never });
    expect(fixtureProblems(notText)).toEqual(["provider_ids: JSON must be text"]);
    const notJson = series({ providerIds: "[Dr. Lark]" });
    expect(fixtureProblems(notJson)).toEqual(["provider_ids: is not JSON text"]);
  });

  test("a boolean that isn't 1 or 0, and a timestamp that isn't PowerSync's text, fail", () => {
    expect(fixtureProblems(fx.provider({ isPrimary: true as never }))).toEqual([
      "is_primary: a boolean must be 1 or 0",
    ]);
    expect(fixtureProblems(fx.note({ occurredAt: "2027-06-09T12:00:00.000Z" }))).toEqual([
      "occurred_at: a timestamp must be PowerSync's text (2026-11-17T21:45:25.229000Z)",
      "created_at: a timestamp must be PowerSync's text (2026-11-17T21:45:25.229000Z)",
      "updated_at: a timestamp must be PowerSync's text (2026-11-17T21:45:25.229000Z)",
    ]);
  });

  test("a fixture tag has the id a device derives for its name, in any case or spacing", async () => {
    const name = "  Care   HOME move ";
    const device = await renderWithDevice({ element: <p>Device</p> });
    const created = await createTag(device.db, TEST_GROUP.id, name);
    expect(created).toEqual({ ok: true, id: tag(name).id });
    expect(tag(name).id).toBe(tag("Care home move").id);
  });
});
