import type {
  CarePeriodType,
  DoseStatus,
  MedicationChangeType,
  MedicationSchedule,
  SymptomDetails,
  VitalReading,
} from "@caretook/data/schema";

import { encodeNoteDoc, entryProviderId, noteDocFromText } from "@caretook/data/schema";
import { getTableColumns, getTableName } from "drizzle-orm";
import { drizzleSchema } from "~/lib/sync/schema";
import { toLocalTimestamp } from "~/lib/sync/timeline";

// Fixture builders for the test device: rows as the device holds them after
// a sync (the device schema's columns, PowerSync's timestamp text, JSON as
// text). Every builder takes camelCase overrides and fills the rest with
// stable, fictional defaults in the default group (`TEST_GROUP`). A builder's
// result carries its `id`, and `with` for rows that come along (a note's
// document, a member's user row). Pass them, nested as you like, to
// `renderWithDevice({ fixtures })` or `device.sync(...)`.
//
// All names, places and readings are made up.

type Tables = typeof drizzleSchema;
type TableKey = keyof Tables;
type Values<K extends TableKey> = Partial<Tables[K]["$inferSelect"]> & { id: string };

/** One device row, ready to insert. `with` rows go in with it. */
export type Fixture = {
  table: string;
  id: string;
  row: Record<string, unknown> & { id: string };
  with?: Fixture[];
};

/** What `fixtures` accepts: fixtures, nested arrays of them, and nothing (for `cond && fx…`). */
export type Fixtures = Fixture | readonly Fixtures[] | null | undefined | false;

/** Fixtures in insert order, `with` rows after their owner. */
export const flattenFixtures = (fixtures: Fixtures): Fixture[] => {
  if (!fixtures) return [];
  if (Array.isArray(fixtures)) return (fixtures as readonly Fixtures[]).flatMap(flattenFixtures);
  const fixture = fixtures as Fixture;
  return [fixture, ...flattenFixtures(fixture.with ?? [])];
};

const row = <K extends TableKey>(key: K, values: Values<K>, extra: Fixture[] = []): Fixture => {
  const table = drizzleSchema[key];
  const columns = getTableColumns(table) as Record<string, { name: string }>;
  const out: Record<string, unknown> = {};
  for (const [field, value] of Object.entries(values)) {
    if (value === undefined) continue;
    const column = columns[field];
    if (!column) throw new Error(`fixtures: ${getTableName(table)} has no field "${field}"`);
    out[column.name] = value;
  }
  return { table: getTableName(table), id: values.id, row: out as Fixture["row"], with: extra };
};

/** A new random id (UUID v4). */
export const newId = () => crypto.randomUUID();

/** PowerSync's timestamp text for a moment (an ISO string, a Date, or "now"). */
export const at = (when: string | Date = new Date()) => toLocalTimestamp(when);

/** `hours` before now, as PowerSync's timestamp text. */
export const hoursAgo = (hours: number) => at(new Date(Date.now() - hours * 3_600_000));

// --- The default world -------------------------------------------------------

export const TEST_TIME_ZONE = "America/Los_Angeles";

/** The signed-in user unless a test says otherwise. */
export const TEST_USER = {
  id: "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2f1a01",
  name: "Alex Moreno",
  email: "alex.moreno@example.com",
  image: null,
} as const;

export const TEST_GROUP = { id: "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2f1b01", name: "Moreno Family" } as const;

export const TEST_RECIPIENT = {
  id: "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2f1c01",
  name: "June Moreno",
  preferredName: "Grandma June",
} as const;

export type GroupRole = "owner" | "admin" | "caretaker" | "viewer";

const groupId = TEST_GROUP.id;
const recipientId = TEST_RECIPIENT.id;

// --- Groups and people -------------------------------------------------------

const group = (v: Partial<Values<"careGroups">> = {}) =>
  row("careGroups", { id: TEST_GROUP.id, name: TEST_GROUP.name, ...v });

const recipient = (v: Partial<Values<"careRecipients">> = {}) =>
  row("careRecipients", {
    id: recipientId,
    groupId,
    name: TEST_RECIPIENT.name,
    preferredName: TEST_RECIPIENT.preferredName,
    timeZone: TEST_TIME_ZONE,
    ...v,
  });

const user = (v: Partial<Values<"users">> = {}) =>
  row("users", { id: newId(), name: "Sam Okafor", image: null, ...v });

const member = (v: Partial<Values<"careGroupMembers">> & { userId: string }) =>
  row("careGroupMembers", { id: newId(), groupId, role: "caretaker", createdAt: hoursAgo(24 * 30), ...v });

/**
 * A co-member: their public profile (`user`) and membership. The fixture's
 * id is the user's, which is what entries' `createdBy` and filters use.
 */
const person = ({
  id = newId(),
  name = "Sam Okafor",
  role = "caretaker",
  groupId: inGroup = groupId,
}: { id?: string; name?: string; role?: GroupRole; groupId?: string } = {}): Fixture => {
  const profile = user({ id, name });
  return { ...profile, with: [member({ userId: id, role, groupId: inGroup })] };
};

// --- Timeline entries --------------------------------------------------------

type EntryValues = Partial<Values<"timelineEntries">>;

const entryBase = (kind: string, v: EntryValues) => {
  const occurredAt = v.occurredAt ?? hoursAgo(1);
  return {
    id: newId(),
    groupId,
    recipientId,
    kind,
    occurredAt,
    timeZone: TEST_TIME_ZONE,
    createdAt: occurredAt,
    updatedAt: occurredAt,
    createdBy: TEST_USER.id,
    updatedBy: v.createdBy ?? TEST_USER.id,
    allDay: 0,
    ...v,
  };
};

/** A live document (Yjs) holding `text`, owned by an entry, provider, medication or period. */
const document = ({
  ownerId,
  subject = "entry",
  text = "",
  editedBy = TEST_USER.id,
  editedAt = hoursAgo(1),
  ...v
}: Partial<Values<"noteDocuments">> & {
  ownerId: string;
  subject?: "entry" | "provider" | "medication" | "carePeriod";
  text?: string;
  editedBy?: string;
  editedAt?: string;
}) => {
  const ownerField = {
    entry: "entryId",
    provider: "providerId",
    medication: "medicationId",
    carePeriod: "carePeriodId",
  }[subject];
  return row("noteDocuments", {
    id: ownerId,
    groupId,
    snapshot: encodeNoteDoc(noteDocFromText(text)),
    text,
    editors: JSON.stringify({ [editedBy]: editedAt }),
    createdAt: editedAt,
    updatedAt: editedAt,
    createdBy: editedBy,
    updatedBy: editedBy,
    subject,
    [ownerField]: ownerId,
    ...v,
  });
};

/** A note; with `text`, its live document too. Notes never have a body. */
const note = ({ text, ...v }: EntryValues & { text?: string } = {}) => {
  const entry = entryBase("note", { title: null, body: null, ...v });
  const doc =
    text === undefined
      ? []
      : [document({ ownerId: entry.id, text, editedBy: entry.createdBy ?? TEST_USER.id })];
  return row("timelineEntries", entry, doc);
};

/** An event (a future one is an appointment); with `text`, its document. */
const event = ({ text, ...v }: EntryValues & { text?: string } = {}) => {
  const entry = entryBase("event", { title: "Visit with Dr. Lark", body: null, ...v });
  const doc =
    text === undefined
      ? []
      : [document({ ownerId: entry.id, text, editedBy: entry.createdBy ?? TEST_USER.id })];
  return row("timelineEntries", entry, doc);
};

const symptom = ({ name = "Headache", severity = 3, ...v }: EntryValues & Partial<SymptomDetails> = {}) =>
  row(
    "timelineEntries",
    entryBase("symptom", { details: JSON.stringify({ name, severity } satisfies SymptomDetails), ...v }),
  );

const vital = ({
  readings = [{ type: "heartRate", value: 72 }],
  ...v
}: EntryValues & { readings?: VitalReading[] } = {}) =>
  row("timelineEntries", entryBase("vital", { details: JSON.stringify({ readings }), ...v }));

const dose = ({
  medicationId,
  status = "given",
  amount = "1 tablet",
  scheduledFor = null,
  note: doseNote = null,
  ...v
}: EntryValues & {
  medicationId: string;
  status?: DoseStatus;
  amount?: string | null;
  scheduledFor?: string | null;
  note?: string | null;
}) =>
  row(
    "timelineEntries",
    entryBase("dose", {
      title: null,
      details: JSON.stringify({ medicationId, status, amount, scheduledFor, note: doseNote }),
      ...v,
    }),
  );

const medicationChange = ({
  medicationId,
  change = "started",
  ...v
}: EntryValues & { medicationId: string; change?: MedicationChangeType }) =>
  row(
    "timelineEntries",
    entryBase("medicationChange", { title: null, details: JSON.stringify({ medicationId, change }), ...v }),
  );

// --- Providers, medications, periods -----------------------------------------

const provider = ({
  phones = [{ label: "Office", number: "555-0100" }],
  ...v
}: Partial<Omit<Values<"providers">, "phones">> & { phones?: { label: string; number: string }[] } = {}) => {
  const created = hoursAgo(24 * 60);
  return row("providers", {
    id: newId(),
    groupId,
    type: "clinician",
    name: "Dr. Mira Lark",
    specialty: "Family medicine",
    phones: JSON.stringify(phones),
    status: "current",
    isPrimary: 0,
    createdAt: created,
    updatedAt: created,
    createdBy: TEST_USER.id,
    updatedBy: TEST_USER.id,
    ...v,
  });
};

/** A note or event linked to a provider (the "with …" line). */
const link = (entryId: string, providerId: string, v: Partial<Values<"timelineEntryProviders">> = {}) => {
  const created = hoursAgo(1);
  return row("timelineEntryProviders", {
    id: entryProviderId(entryId, providerId),
    groupId,
    entryId,
    providerId,
    createdAt: created,
    updatedAt: created,
    createdBy: TEST_USER.id,
    updatedBy: TEST_USER.id,
    ...v,
  });
};

const medication = ({
  schedule = { type: "scheduled", times: ["08:00"] },
  ...v
}: Partial<Omit<Values<"medications">, "schedule">> & { schedule?: MedicationSchedule } = {}) => {
  const created = hoursAgo(24 * 30);
  return row("medications", {
    id: newId(),
    groupId,
    recipientId,
    name: "Lisinopril",
    strength: "10 mg",
    form: "tablet",
    dose: "1 tablet",
    schedule: JSON.stringify(schedule),
    status: "current",
    startedOn: created.slice(0, 10),
    createdAt: created,
    updatedAt: created,
    createdBy: TEST_USER.id,
    updatedBy: TEST_USER.id,
    ...v,
  });
};

const period = ({ type = "home", ...v }: Partial<Values<"carePeriods">> & { type?: CarePeriodType } = {}) => {
  const started = v.startedAt ?? hoursAgo(24 * 14);
  return row("carePeriods", {
    id: newId(),
    groupId,
    recipientId,
    type,
    startedAt: started,
    dateOnly: 0,
    createdAt: started,
    updatedAt: started,
    createdBy: TEST_USER.id,
    updatedBy: TEST_USER.id,
    ...v,
  });
};

/** The builders. Each returns a `Fixture` with defaults in `TEST_GROUP`. */
export const fx = {
  group,
  recipient,
  user,
  member,
  person,
  note,
  event,
  symptom,
  vital,
  dose,
  medicationChange,
  document,
  provider,
  link,
  medication,
  period,
};
