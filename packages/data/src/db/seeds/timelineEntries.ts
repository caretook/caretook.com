import type { TimelineEntryDetails, TimelineEntryKind } from "../schema";

import { inArray } from "drizzle-orm";
import { getDb } from "../client";
import { timelineEntrySchema, userSchema } from "../schema";
import { DEV_GROUP_ID, DEV_RECIPIENT_ID } from "./careGroups";

const TIME_ZONE = "America/Los_Angeles";
const HOUR = 60 * 60 * 1000;

type SeedEntry = {
  /** Hours before seeding time. */
  hoursAgo: number;
  author: "member@example.com" | "caretaker@example.com";
  kind: TimelineEntryKind;
  title?: string;
  body?: string;
  details?: TimelineEntryDetails;
  deleted?: boolean;
};

// About a week of Grandma Pat's timeline, written by the owner and the caretaker.
const ENTRIES: SeedEntry[] = [
  { hoursAgo: 1, author: "caretaker@example.com", kind: "note", body: "Ate most of lunch. Good spirits." },
  {
    hoursAgo: 3,
    author: "caretaker@example.com",
    kind: "symptom",
    details: { name: "Knee pain", severity: 4 },
    body: "Left knee, after the walk.",
  },
  {
    hoursAgo: 6,
    author: "member@example.com",
    kind: "event",
    title: "Physical therapy",
    body: "45 minutes.",
  },
  { hoursAgo: 20, author: "member@example.com", kind: "note", body: "Slept through the night." },
  {
    hoursAgo: 26,
    author: "caretaker@example.com",
    kind: "symptom",
    details: { name: "Dizziness", severity: 2 },
  },
  { hoursAgo: 30, author: "caretaker@example.com", kind: "note", body: "Asked about the garden again." },
  { hoursAgo: 44, author: "member@example.com", kind: "event", title: "Pharmacy pickup" },
  { hoursAgo: 50, author: "caretaker@example.com", kind: "symptom", details: { name: "Fatigue" } },
  { hoursAgo: 52, author: "caretaker@example.com", kind: "note", body: "Wrong entry", deleted: true },
  { hoursAgo: 70, author: "member@example.com", kind: "note", body: "Called with Aunt June for an hour." },
  {
    hoursAgo: 75,
    author: "caretaker@example.com",
    kind: "symptom",
    details: { name: "Knee pain", severity: 6 },
    body: "Iced it for 20 minutes.",
  },
  {
    hoursAgo: 96,
    author: "member@example.com",
    kind: "event",
    title: "Fall (no injury)",
    body: "In the hallway at night. Added a nightlight.",
  },
  { hoursAgo: 100, author: "caretaker@example.com", kind: "note", body: "Appetite low at dinner." },
  {
    hoursAgo: 120,
    author: "caretaker@example.com",
    kind: "symptom",
    details: { name: "Headache", severity: 3 },
  },
  { hoursAgo: 125, author: "member@example.com", kind: "event", title: "Family visit" },
  { hoursAgo: 140, author: "caretaker@example.com", kind: "note", body: "Walked to the mailbox and back." },
  {
    hoursAgo: 150,
    author: "member@example.com",
    kind: "note",
    body: "Reorganized the pill organizer for the week.",
  },
  {
    hoursAgo: 165,
    author: "caretaker@example.com",
    kind: "symptom",
    details: { name: "Shortness of breath", severity: 3 },
    body: "On the stairs.",
  },
  { hoursAgo: 170, author: "member@example.com", kind: "event", title: "Eye exam" },
  { hoursAgo: 190, author: "caretaker@example.com", kind: "note", body: "Started the new puzzle." },
];

// Fixed ids keep the seed idempotent: ...c1001, ...c1002, …
const entryId = (index: number) => `0b6f3c1e-5d1a-4c2e-9a77-3f1d2b8c${String(1001 + index).padStart(4, "0")}`;

export const seed = async () => {
  const db = getDb();

  const authors = [...new Set(ENTRIES.map((e) => e.author))];
  const users = await db
    .select({ id: userSchema.id, email: userSchema.email })
    .from(userSchema)
    .where(inArray(userSchema.email, authors));
  const idByEmail = new Map(users.map((u) => [u.email, u.id]));

  const now = Date.now();
  const rows = ENTRIES.flatMap((entry, index) => {
    const authorId = idByEmail.get(entry.author);
    if (!authorId) return [];
    const occurredAt = new Date(now - entry.hoursAgo * HOUR).toISOString();
    return [
      {
        id: entryId(index),
        groupId: DEV_GROUP_ID,
        recipientId: DEV_RECIPIENT_ID,
        kind: entry.kind,
        occurredAt,
        timeZone: TIME_ZONE,
        title: entry.title ?? null,
        body: entry.body ?? null,
        details: entry.details ?? null,
        deletedAt: entry.deleted ? occurredAt : null,
        createdBy: authorId,
        updatedBy: authorId,
      },
    ];
  });

  if (rows.length) {
    await db.insert(timelineEntrySchema).values(rows).onConflictDoNothing({ target: timelineEntrySchema.id });
  }
};
