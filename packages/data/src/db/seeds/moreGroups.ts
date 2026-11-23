import type { GroupRoleName } from "../../constants/roles";
import type { MedicationContentInput, ProviderPhone, UserInsert } from "../schema";
import type { SeedEntry } from "./timelineEntries";

import { inArray } from "drizzle-orm";
import { SYSTEM_USER } from "../../constants";
import { getDb } from "../client";
import {
  accountSchema,
  careGroupMemberSchema,
  careGroupSchema,
  careRecipientSchema,
  encodeNoteDoc,
  medicationChange,
  medicationChangeId,
  medicationContentZSchema,
  medicationSchema,
  noteDocFromText,
  noteDocumentSchema,
  noteText,
  providerSchema,
  timelineEntrySchema,
  userSchema,
} from "../schema";
import { seedPasswordHash } from "./accounts";
import { occurredAtOf, seedContentOf } from "./timelineEntries";

// More care groups and a mix of users, for trying roles by hand (B-90).
// Every name, number and address is made up. The existing seed users'
// memberships don't change: checks rely on member@ having two groups and
// caretaker@ and viewer@ one each. None of these users is in Dev Family or
// Dev Family 2.
//
//   trio@        owner of Rivera, caretaker in Okafor, viewer in Chen (three groups)
//   groupadmin@  admin of Rivera, and in no other group
//   viewer2@     viewer in Rivera and Okafor
//   owner2@      owner of Okafor and Chen
//   solo@        owner of Solo Care, which has no other members
//
// Own ids (…3f1d2bd0… groups and recipients, …bd1… entries, …bd2…
// providers, …bd3… medications), following list order: append only.

const seedAudits = { createdBy: SYSTEM_USER.id, updatedBy: SYSTEM_USER.id };

export const MORE_USERS = [
  { email: "trio@example.com", name: "Dev Trio" },
  { email: "groupadmin@example.com", name: "Dev Group Admin" },
  { email: "viewer2@example.com", name: "Dev Viewer Two" },
  { email: "owner2@example.com", name: "Dev Owner Two" },
  { email: "solo@example.com", name: "Dev Solo" },
] as const satisfies readonly Pick<UserInsert, "email" | "name">[];

type Email = (typeof MORE_USERS)[number]["email"];
type MoreEntry = Omit<SeedEntry, "author"> & { author: Email };

export type MoreGroup = {
  name: string;
  recipient: { name: string; preferredName?: string; dateOfBirth: string; timeZone: string };
  members: { email: Email; role: GroupRoleName }[];
  entries: MoreEntry[];
  provider: { name: string; specialty: string; phones: ProviderPhone[]; address: string };
  medication: {
    hoursAgo: number;
    author: Email;
    content: Omit<MedicationContentInput, "prescriberId" | "pharmacyId" | "startedOn">;
  };
};

const ids = "0b6f3c1e-5d1a-4c2e-9a77-3f1d2bd";
const at = (range: number, group: number, index: number) =>
  `${ids}${range}${group}${String(index).padStart(3, "0")}`;
export const groupId = (group: number) => at(0, group, 1);
export const recipientId = (group: number) => at(0, group, 2);
export const entryId = (group: number, index: number) => at(1, group, index + 1);
export const providerId = (group: number) => at(2, group, 1);
export const medicationId = (group: number) => at(3, group, 1);

export const MORE_GROUPS: MoreGroup[] = [
  {
    name: "Rivera Family",
    recipient: {
      name: "Ana Example",
      preferredName: "Abuela Ana",
      dateOfBirth: "1941-03-14",
      timeZone: "America/Los_Angeles",
    },
    members: [
      { email: "trio@example.com", role: "owner" },
      { email: "groupadmin@example.com", role: "admin" },
      { email: "viewer2@example.com", role: "viewer" },
    ],
    entries: [
      {
        hoursAgo: 3,
        author: "trio@example.com",
        kind: "note",
        body: "Good appetite at lunch. Asked about the garden.",
      },
      {
        hoursAgo: 9,
        author: "groupadmin@example.com",
        kind: "vital",
        details: { readings: [{ type: "bloodPressure", systolic: 134, diastolic: 82 }] },
      },
      {
        hoursAgo: 28,
        author: "trio@example.com",
        kind: "symptom",
        details: { name: "Knee pain", severity: 4 },
        body: "Worse on the stairs.",
      },
      {
        hoursAgo: 52,
        author: "groupadmin@example.com",
        kind: "event",
        title: "Eye exam",
        body: "New glasses ordered.",
      },
    ],
    provider: {
      name: "Dr. Lena Example",
      specialty: "Primary care",
      phones: [{ label: "Office", number: "(555) 010-3100" }],
      address: "12 Example Way, Springfield",
    },
    medication: {
      hoursAgo: 24 * 12,
      author: "trio@example.com",
      content: {
        name: "Amlodipine",
        strength: "5 mg",
        form: "tablet",
        dose: "1 tablet",
        reason: "Blood pressure",
        schedule: { type: "scheduled", times: ["09:00"] },
      },
    },
  },
  {
    name: "Okafor Family",
    recipient: {
      name: "Ben Example",
      preferredName: "Pops",
      dateOfBirth: "1944-11-02",
      timeZone: "America/New_York",
    },
    members: [
      { email: "owner2@example.com", role: "owner" },
      { email: "trio@example.com", role: "caretaker" },
      { email: "viewer2@example.com", role: "viewer" },
    ],
    entries: [
      { hoursAgo: 5, author: "trio@example.com", kind: "note", body: "Walked to the mailbox and back." },
      {
        hoursAgo: 20,
        author: "owner2@example.com",
        kind: "vital",
        details: {
          readings: [
            { type: "heartRate", value: 72 },
            { type: "spo2", value: 96 },
          ],
        },
      },
      {
        hoursAgo: 46,
        author: "owner2@example.com",
        kind: "event",
        title: "Pharmacy pickup",
        body: "Picked up refills.",
      },
    ],
    provider: {
      name: "Dr. Omar Example",
      specialty: "Cardiology",
      phones: [{ label: "Office", number: "(555) 010-3200" }],
      address: "40 Sample Street, Riverton",
    },
    medication: {
      hoursAgo: 24 * 20,
      author: "owner2@example.com",
      content: {
        name: "Atorvastatin",
        strength: "20 mg",
        form: "tablet",
        dose: "1 tablet",
        reason: "Cholesterol",
        schedule: { type: "scheduled", times: ["21:00"] },
      },
    },
  },
  {
    name: "Chen Family",
    recipient: { name: "Mei Example", dateOfBirth: "1939-05-21", timeZone: "America/Chicago" },
    members: [
      { email: "owner2@example.com", role: "owner" },
      { email: "trio@example.com", role: "viewer" },
    ],
    entries: [
      {
        hoursAgo: 7,
        author: "owner2@example.com",
        kind: "note",
        body: "Played mahjong with the neighbours.",
      },
      {
        hoursAgo: 30,
        author: "owner2@example.com",
        kind: "symptom",
        details: { name: "Dizziness", severity: 2 },
        body: "Brief, after standing up quickly.",
      },
      { hoursAgo: 60, author: "owner2@example.com", kind: "event", title: "Hair appointment" },
    ],
    provider: {
      name: "Dr. Grace Example",
      specialty: "Geriatrics",
      phones: [{ label: "Office", number: "(555) 010-3300" }],
      address: "7 Placeholder Avenue, Lakeside",
    },
    medication: {
      hoursAgo: 24 * 30,
      author: "owner2@example.com",
      content: {
        name: "Vitamin D3",
        strength: "1000 IU",
        form: "capsule",
        dose: "1 capsule",
        schedule: { type: "scheduled", times: ["08:00"] },
      },
    },
  },
  {
    name: "Solo Care",
    recipient: { name: "Ray Example", dateOfBirth: "1947-08-09", timeZone: "America/Denver" },
    members: [{ email: "solo@example.com", role: "owner" }],
    entries: [
      {
        hoursAgo: 2,
        author: "solo@example.com",
        kind: "note",
        body: "Set up the pill organiser for the week.",
      },
      {
        hoursAgo: 26,
        author: "solo@example.com",
        kind: "vital",
        details: { readings: [{ type: "weight", value: 78.5 }] },
      },
    ],
    provider: {
      name: "Dr. Sam Example",
      specialty: "Family medicine",
      phones: [{ label: "Office", number: "(555) 010-3400" }],
      address: "3 Demo Road, Hillview",
    },
    medication: {
      hoursAgo: 24 * 5,
      author: "solo@example.com",
      content: {
        name: "Ibuprofen",
        strength: "200 mg",
        form: "tablet",
        dose: "1 tablet",
        reason: "Joint pain",
        schedule: { type: "asNeeded", maxPerDay: 3 },
      },
    },
  },
];

/** Every group as rows, ids resolved; authors still by email. */
export const seedRows = (now = Date.now()) =>
  MORE_GROUPS.map((group, g) => {
    const gid = groupId(g);
    const rid = recipientId(g);
    const { timeZone } = group.recipient;

    const entries = group.entries.map((entry, index) => {
      const occurredAt = occurredAtOf(entry, now).toISOString();
      const { documentText, ...content } = seedContentOf(entry);
      return {
        row: {
          id: entryId(g, index),
          groupId: gid,
          recipientId: rid,
          kind: entry.kind,
          occurredAt,
          timeZone,
          ...content,
        },
        author: entry.author,
        documentText,
      };
    });

    const provider = {
      id: providerId(g),
      groupId: gid,
      type: "clinician" as const,
      name: group.provider.name,
      specialty: group.provider.specialty,
      practiceId: null,
      phones: group.provider.phones,
      email: null,
      address: group.provider.address,
      website: null,
      status: "current" as const,
      isPrimary: true,
    };

    const addedAt = new Date(now - group.medication.hoursAgo * 60 * 60 * 1000).toISOString();
    const startedOn = new Intl.DateTimeFormat("en-CA", { timeZone }).format(new Date(addedAt));
    const content = medicationContentZSchema.parse({
      ...group.medication.content,
      startedOn,
      prescriberId: provider.id,
    });
    const medication = { id: medicationId(g), groupId: gid, recipientId: rid, ...content };
    const change = medicationChange(null, content);
    const medicationEntry = change && {
      id: medicationChangeId(medication.id, addedAt),
      groupId: gid,
      recipientId: rid,
      kind: "medicationChange" as const,
      occurredAt: addedAt,
      timeZone,
      title: null,
      body: null,
      details: { medicationId: medication.id, ...change },
    };

    return { group, groupId: gid, recipientId: rid, entries, provider, medication, medicationEntry, addedAt };
  });

export const seed = async () => {
  const db = getDb();
  await db
    .insert(userSchema)
    .values(MORE_USERS.map((u) => ({ ...u, role: "member" as const, emailVerified: true, ...seedAudits })))
    .onConflictDoNothing({ target: userSchema.email });
  const users = await db
    .select({ id: userSchema.id, email: userSchema.email })
    .from(userSchema)
    .where(
      inArray(
        userSchema.email,
        MORE_USERS.map((u) => u.email),
      ),
    );
  const idByEmail = new Map(users.map((u) => [u.email, u.id]));
  const userId = (email: Email) => {
    const id = idByEmail.get(email);
    if (!id) throw new Error(`Seed user missing: ${email}`);
    return id;
  };

  const password = process.env.SEED_USER_PASSWORD;
  if (password) {
    const hash = await seedPasswordHash(password);
    await db
      .insert(accountSchema)
      .values(users.map((u) => ({ userId: u.id, providerId: "credential", accountId: u.id, password: hash })))
      .onConflictDoNothing({ target: [accountSchema.providerId, accountSchema.accountId] });
  }

  for (const rows of seedRows()) {
    const { group } = rows;
    const owner = userId(group.members.find((m) => m.role === "owner")?.email ?? group.medication.author);
    const by = (email: Email) => ({ createdBy: userId(email), updatedBy: userId(email) });

    await db
      .insert(careGroupSchema)
      .values({ id: rows.groupId, name: group.name, createdBy: owner, updatedBy: owner })
      .onConflictDoNothing({ target: careGroupSchema.id });
    await db
      .insert(careRecipientSchema)
      .values({ id: rows.recipientId, groupId: rows.groupId, ...group.recipient, ...seedAudits })
      .onConflictDoNothing({ target: careRecipientSchema.id });
    await db
      .insert(careGroupMemberSchema)
      .values(
        group.members.map(({ email, role }) => ({
          groupId: rows.groupId,
          userId: userId(email),
          role,
          ...seedAudits,
        })),
      )
      .onConflictDoNothing({ target: [careGroupMemberSchema.groupId, careGroupMemberSchema.userId] });

    // One statement per table, not per row: a seed run is mostly round trips (B-466).
    if (rows.entries.length) {
      await db
        .insert(timelineEntrySchema)
        .values(
          rows.entries.map(({ row, author }) => ({
            ...row,
            createdAt: row.occurredAt,
            updatedAt: row.occurredAt,
            ...by(author),
          })),
        )
        .onConflictDoNothing({ target: timelineEntrySchema.id });
    }
    // Notes and events: their text is their live document, already compacted.
    const documents = rows.entries.flatMap(({ row, author, documentText }) => {
      if (documentText === null) return [];
      const doc = noteDocFromText(documentText);
      const document = {
        id: row.id,
        groupId: rows.groupId,
        subject: "entry" as const,
        entryId: row.id,
        snapshot: encodeNoteDoc(doc),
        text: noteText(doc),
        editors: { [userId(author)]: row.occurredAt },
        createdAt: row.occurredAt,
        updatedAt: row.occurredAt,
        ...by(author),
      };
      doc.destroy();
      return [document];
    });
    if (documents.length) {
      await db
        .insert(noteDocumentSchema)
        .values(documents)
        .onConflictDoNothing({ target: noteDocumentSchema.id });
    }

    await db
      .insert(providerSchema)
      .values({ ...rows.provider, createdBy: owner, updatedBy: owner })
      .onConflictDoNothing({ target: providerSchema.id });

    const added = { createdAt: rows.addedAt, updatedAt: rows.addedAt, ...by(group.medication.author) };
    await db
      .insert(medicationSchema)
      .values({ ...rows.medication, ...added })
      .onConflictDoNothing({ target: medicationSchema.id });
    if (rows.medicationEntry) {
      await db
        .insert(timelineEntrySchema)
        .values({ ...rows.medicationEntry, ...added })
        .onConflictDoNothing({ target: timelineEntrySchema.id });
    }
  }
};
