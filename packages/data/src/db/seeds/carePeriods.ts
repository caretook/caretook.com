import type { CarePeriodType } from "../schema";

import { inArray } from "drizzle-orm";
import { getDb } from "../client";
import { carePeriodSchema, noteDocumentSchema, userSchema } from "../schema";
import { DEV_GROUP_ID, DEV_RECIPIENT_ID } from "./careGroups";
import { SEED_GROUPS as PROVIDER_GROUPS } from "./providers";
import { addDays, dayStart, localDate } from "../../domain/core/entryTiming";
import { encodeNoteDoc, noteDocFromText, noteText } from "../../domain/live-notes/noteYjs";

// Fictional care periods for Grandma Pat (Dev Family): at home from eight
// weeks ago, a night in the emergency room, then the hospital (Mercy General,
// a seeded provider, with a room), ten days of rehab, and home again. Placed
// relative to the seeding time in her zone. Dev Family 2 gets none, so the
// writer's "Where is Lou now?" prompt shows on member@'s second group.
//
// Their own ids (…3f1d2bc1…), following list order: append only.

const TIME_ZONE = "America/Los_Angeles";
const DAY = 24 * 60 * 60 * 1000;

type Author = "member@example.com" | "caretaker@example.com";

export type SeedCarePeriod = {
  type: CarePeriodType;
  /** Days before today, in America/Los_Angeles. */
  daysAgo: number;
  /** Local time; omit for a date-only start. */
  time?: `${number}:${number}`;
  label?: string;
  /** A provider key (`seeds/providers.ts`) in the same group. */
  place?: string;
  placeDetail?: string;
  author: Author;
  /** The period's live notes (one paragraph per line, "• " for bullets). */
  notes?: string;
};

export const DEV_FAMILY_CARE_PERIODS: SeedCarePeriod[] = [
  { type: "home", daysAgo: 56, author: "member@example.com" },
  {
    type: "emergency",
    daysAgo: 22,
    time: "18:40",
    label: "Mercy General ER",
    place: "mercy",
    author: "caretaker@example.com",
  },
  {
    type: "hospital",
    daysAgo: 21,
    time: "02:15",
    label: "Cardiac unit (4 West)",
    place: "mercy",
    placeDetail: "Room 412, bed B",
    author: "caretaker@example.com",
    notes: [
      "Visiting hours 11:00–20:00. Two visitors at a time.",
      "Nurse station: ask for the charge nurse on 4 West.",
      "Discharge instructions",
      "• Weigh every morning; call if up more than 2 lb in a day.",
      "• Low-salt meals; no more than 1.5 L of fluids a day.",
    ].join("\n"),
  },
  { type: "rehab", daysAgo: 15, label: "Oak Hills Rehab", author: "member@example.com" },
  { type: "home", daysAgo: 5, time: "14:20", author: "member@example.com" },
];

export const carePeriodId = (index: number) =>
  `0b6f3c1e-5d1a-4c2e-9a77-3f1d2bc1${String(1001 + index).padStart(4, "0")}`;

const placeIdOf = (key: string) => {
  const group = PROVIDER_GROUPS.find((g) => g.groupId === DEV_GROUP_ID);
  const index = group?.providers.findIndex((p) => p.key === key) ?? -1;
  if (!group || index < 0) throw new Error(`Seed care period is at a missing provider: ${key}`);
  return group.providerId(index);
};

/** When a seed period started: the start of its day (date-only), or its local time that day. */
export const startedAtOf = (period: SeedCarePeriod, now: number) => {
  const day = addDays(localDate(now, TIME_ZONE), -period.daysAgo);
  const start = dayStart(day, TIME_ZONE);
  if (!period.time) return new Date(start).toISOString();
  const [h, m] = period.time.split(":").map(Number);
  return new Date(start + ((h ?? 0) * 60 + (m ?? 0)) * 60_000).toISOString();
};

/** Every seed period as rows (content columns as the content schema takes them). */
export const seedRows = (now: number) =>
  DEV_FAMILY_CARE_PERIODS.map((p, i) => ({
    id: carePeriodId(i),
    groupId: DEV_GROUP_ID,
    recipientId: DEV_RECIPIENT_ID,
    author: p.author,
    notes: p.notes ?? null,
    content: {
      type: p.type,
      label: p.label ?? null,
      placeProviderId: p.place ? placeIdOf(p.place) : null,
      placeDetail: p.placeDetail ?? null,
      startedAt: startedAtOf(p, now),
      dateOnly: !p.time,
    },
  }));

export const seed = async () => {
  const db = getDb();
  const authors = [...new Set(DEV_FAMILY_CARE_PERIODS.map((p) => p.author))];
  const users = await db
    .select({ id: userSchema.id, email: userSchema.email })
    .from(userSchema)
    .where(inArray(userSchema.email, authors));
  const idByEmail = new Map(users.map((u) => [u.email, u.id]));

  const now = Date.now();
  // Notes written two days ago, so nobody shows as typing.
  const writtenAt = new Date(now - 2 * DAY).toISOString();
  for (const { id, groupId, recipientId, author, notes, content } of seedRows(now)) {
    const authorId = idByEmail.get(author);
    if (!authorId) continue;
    const audits = { createdBy: authorId, updatedBy: authorId };
    // Recorded when it started.
    await db
      .insert(carePeriodSchema)
      .values({
        id,
        groupId,
        recipientId,
        ...content,
        createdAt: content.startedAt,
        updatedAt: content.startedAt,
        ...audits,
      })
      .onConflictDoNothing({ target: carePeriodSchema.id });
    if (!notes) continue;
    const doc = noteDocFromText(notes);
    await db
      .insert(noteDocumentSchema)
      .values({
        id,
        groupId,
        subject: "carePeriod",
        carePeriodId: id,
        snapshot: encodeNoteDoc(doc),
        text: noteText(doc),
        editors: { [authorId]: writtenAt },
        createdAt: writtenAt,
        updatedAt: writtenAt,
        ...audits,
      })
      .onConflictDoNothing({ target: noteDocumentSchema.id });
    doc.destroy();
  }
};
