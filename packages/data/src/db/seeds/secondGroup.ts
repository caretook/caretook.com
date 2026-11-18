import type { SeedEntry } from "./timelineEntries";

import { eq } from "drizzle-orm";
import { SYSTEM_USER } from "../../constants";
import { getDb } from "../client";
import {
  careGroupMemberSchema,
  careGroupSchema,
  careRecipientSchema,
  encodeNoteDoc,
  noteDocFromText,
  noteDocumentSchema,
  noteText,
  timelineEntrySchema,
  userSchema,
} from "../schema";
import { occurredAtOf, seedContentOf } from "./timelineEntries";

// A second, smaller care group, so switching groups can be tried in dev.
// member@ is its only member (owner); caretaker@ and viewer@ stay in one
// group each. Its own ids (…3f1d2b8d…), so it never shifts "Dev Family"'s.

const seedAudits = { createdBy: SYSTEM_USER.id, updatedBy: SYSTEM_USER.id };

export const SECOND_GROUP_ID = "0b6f3c1e-5d1a-4c2e-9a77-3f1d2b8d0001";
export const SECOND_RECIPIENT_ID = "0b6f3c1e-5d1a-4c2e-9a77-3f1d2b8d0002";
const OWNER_EMAIL = "member@example.com";
const TIME_ZONE = "America/Los_Angeles";

// Fixed ids that follow list order (…8d1001, …8d1002, …): append only.
const entryId = (index: number) => `0b6f3c1e-5d1a-4c2e-9a77-3f1d2b8d${String(1001 + index).padStart(4, "0")}`;

/** A few days of Grandpa Lou's timeline (fictional). */
export const SECOND_GROUP_ENTRIES: SeedEntry[] = [
  { hoursAgo: 4, author: OWNER_EMAIL, kind: "note", body: "Watched the ball game together. Cheerful." },
  {
    hoursAgo: 10,
    author: OWNER_EMAIL,
    kind: "symptom",
    details: { name: "Back pain", severity: 3 },
    body: "Lower back, after gardening.",
  },
  {
    hoursAgo: 26,
    author: OWNER_EMAIL,
    kind: "vital",
    details: {
      readings: [
        { type: "bloodPressure", systolic: 128, diastolic: 80 },
        { type: "heartRate", value: 68 },
      ],
    },
  },
  {
    hoursAgo: 50,
    author: OWNER_EMAIL,
    kind: "event",
    title: "Hearing aid fitting",
    body: "New batteries too.",
  },
  { hoursAgo: 74, author: OWNER_EMAIL, kind: "note", body: "Asked for crossword books." },
];

export const seed = async () => {
  const db = getDb();

  await db
    .insert(careGroupSchema)
    .values({ id: SECOND_GROUP_ID, name: "Dev Family 2", ...seedAudits })
    .onConflictDoNothing({ target: careGroupSchema.id });

  await db
    .insert(careRecipientSchema)
    .values({
      id: SECOND_RECIPIENT_ID,
      groupId: SECOND_GROUP_ID,
      name: "Lou Example",
      preferredName: "Grandpa Lou",
      dateOfBirth: "1938-07-02",
      ...seedAudits,
    })
    .onConflictDoNothing({ target: careRecipientSchema.id });

  const [owner] = await db
    .select({ id: userSchema.id })
    .from(userSchema)
    .where(eq(userSchema.email, OWNER_EMAIL));
  if (!owner) return;

  await db
    .insert(careGroupMemberSchema)
    .values({ groupId: SECOND_GROUP_ID, userId: owner.id, role: "owner", ...seedAudits })
    .onConflictDoNothing({ target: [careGroupMemberSchema.groupId, careGroupMemberSchema.userId] });

  const now = Date.now();
  for (const [index, entry] of SECOND_GROUP_ENTRIES.entries()) {
    const id = entryId(index);
    const occurredAt = occurredAtOf(entry, now).toISOString();
    const { documentText, ...content } = seedContentOf(entry);
    await db
      .insert(timelineEntrySchema)
      .values({
        id,
        groupId: SECOND_GROUP_ID,
        recipientId: SECOND_RECIPIENT_ID,
        kind: entry.kind,
        occurredAt,
        timeZone: TIME_ZONE,
        ...content,
        deletedAt: entry.deleted ? occurredAt : null,
        createdBy: owner.id,
        updatedBy: owner.id,
      })
      .onConflictDoNothing({ target: timelineEntrySchema.id });

    // Notes and events: their text is their live document, already compacted.
    if (documentText === null) continue;
    const doc = noteDocFromText(documentText);
    await db
      .insert(noteDocumentSchema)
      .values({
        id,
        groupId: SECOND_GROUP_ID,
        snapshot: encodeNoteDoc(doc),
        text: noteText(doc),
        editors: { [owner.id]: occurredAt },
        createdAt: occurredAt,
        updatedAt: occurredAt,
        createdBy: owner.id,
        updatedBy: owner.id,
      })
      .onConflictDoNothing({ target: noteDocumentSchema.id });
    doc.destroy();
  }
};
