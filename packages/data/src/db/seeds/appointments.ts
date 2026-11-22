import { inArray } from "drizzle-orm";
import { getDb } from "../client";
import {
  encodeNoteDoc,
  entryProviderId,
  noteDocFromText,
  noteDocumentSchema,
  noteText,
  timelineEntryProviderSchema,
  timelineEntrySchema,
  userSchema,
} from "../schema";
import { DEV_GROUP_ID, DEV_RECIPIENT_ID } from "./careGroups";
import { SEED_GROUPS as PROVIDER_GROUPS } from "./providers";
import { SECOND_GROUP_ID, SECOND_RECIPIENT_ID } from "./secondGroup";
import { occurredAtOf } from "./timelineEntries";

// Fictional appointments (future events), placed
// relative to the seeding time so they stay in the future after a reset:
// about three weeks ahead for Grandma Pat (Dev Family), with a couple of
// cancelled visits in the past, and one appointment for Grandpa Lou.
//
// Their own ids (…3f1d2bb1… for Dev Family, …3f1d2bb2… for Dev Family 2),
// following list order: append only. `rescheduledTo` names another seed in
// the same list by its `key`.

const TIME_ZONE = "America/Los_Angeles";
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

type Author = "member@example.com" | "caretaker@example.com";

export type SeedAppointment = {
  /** A key `rescheduledTo` refers to. */
  key: string;
  /** Local time in America/Los_Angeles, days from today (negative: in the past). */
  daysAhead: number;
  time: `${number}:${number}`;
  /** Minutes after the start; omit for no end. */
  minutes?: number;
  allDay?: boolean;
  author: Author;
  kind: "event";
  title?: string;
  place?: string;
  /** The live document's text (one paragraph per line, "• " for bullets). */
  text?: string;
  /** Provider keys (`seeds/providers.ts`) it's with. */
  with?: string[];
  cancelled?: { reason?: string; rescheduledTo?: string };
};

const HARBOR_HEART = "48 Harbor Heart Center\nSpringfield, CA 90000";
const WESTSIDE = "1200 Westside Ave, Suite 300\nSpringfield, CA 90000";

/** Grandma Pat's upcoming items and two past cancellations (Dev Family). */
export const DEV_FAMILY_APPOINTMENTS: SeedAppointment[] = [
  {
    key: "patel",
    daysAhead: 2,
    time: "10:30",
    minutes: 45,
    author: "member@example.com",
    kind: "event",
    title: "Cardiology follow-up: Dr. Patel",
    place: HARBOR_HEART,
    with: ["patel"],
    text: [
      "Questions for Dr. Patel",
      "• Is the ankle swelling from the new blood pressure pill?",
      "• Can she skip the morning dose before the stress test?",
      "Bring the blood pressure log and the medication list.",
    ].join("\n"),
  },
  {
    key: "alvarez",
    daysAhead: 6,
    time: "09:00",
    author: "caretaker@example.com",
    kind: "event",
    title: "Primary care: Dr. Alvarez",
    place: WESTSIDE,
    with: ["alvarez", "westside"],
    text: "Ask for the flu shot. Fasting labs: nothing to eat after midnight.",
  },
  {
    key: "therapy",
    daysAhead: 1,
    time: "14:00",
    minutes: 60,
    author: "caretaker@example.com",
    kind: "event",
    title: "Physical therapy",
    with: ["maria"],
  },
  {
    key: "hospice",
    daysAhead: 9,
    time: "00:00",
    allDay: true,
    author: "member@example.com",
    kind: "event",
    title: "Hospice intake visit",
    text: "They'll call in the morning with a time window.",
  },
  {
    key: "dentist",
    daysAhead: 4,
    time: "11:00",
    author: "member@example.com",
    kind: "event",
    title: "Dental cleaning",
    cancelled: { reason: "Office closed for the holiday" },
  },
  {
    key: "eyesOld",
    daysAhead: 5,
    time: "13:00",
    author: "member@example.com",
    kind: "event",
    title: "Eye doctor",
    text: "Ask whether the drops can move to the morning.",
    cancelled: { reason: "Doctor out sick", rescheduledTo: "eyesNew" },
  },
  {
    key: "eyesNew",
    daysAhead: 12,
    time: "15:30",
    author: "member@example.com",
    kind: "event",
    title: "Eye doctor",
    text: "Ask whether the drops can move to the morning.",
  },
  {
    key: "ride",
    daysAhead: 17,
    time: "10:00",
    author: "caretaker@example.com",
    kind: "event",
    title: "Ride to the senior center",
  },
  {
    key: "hearing",
    daysAhead: -5,
    time: "10:00",
    author: "caretaker@example.com",
    kind: "event",
    title: "Hearing test",
    cancelled: { reason: "She wasn't feeling well" },
  },
  {
    key: "podiatry",
    daysAhead: -12,
    time: "14:00",
    author: "member@example.com",
    kind: "event",
    title: "Podiatry visit",
    cancelled: {},
  },
];

/** Grandpa Lou's one upcoming appointment (Dev Family 2). */
export const SECOND_GROUP_APPOINTMENTS: SeedAppointment[] = [
  {
    key: "lindqvist",
    daysAhead: 3,
    time: "10:00",
    minutes: 30,
    author: "member@example.com",
    kind: "event",
    title: "Hearing aid check: Dr. Lindqvist",
    with: ["lindqvist"],
  },
];

type Group = {
  groupId: string;
  recipientId: string;
  appointments: SeedAppointment[];
  id: (index: number) => string;
};

const GROUPS: Group[] = [
  {
    groupId: DEV_GROUP_ID,
    recipientId: DEV_RECIPIENT_ID,
    appointments: DEV_FAMILY_APPOINTMENTS,
    id: (i) => `0b6f3c1e-5d1a-4c2e-9a77-3f1d2bb1${String(1001 + i).padStart(4, "0")}`,
  },
  {
    groupId: SECOND_GROUP_ID,
    recipientId: SECOND_RECIPIENT_ID,
    appointments: SECOND_GROUP_APPOINTMENTS,
    id: (i) => `0b6f3c1e-5d1a-4c2e-9a77-3f1d2bb2${String(1001 + i).padStart(4, "0")}`,
  },
];

/** The id of a group's seed appointment by its key (todos link to them). */
export const appointmentIdIn = (groupId: string, key: string) => {
  const group = GROUPS.find((g) => g.groupId === groupId);
  const index = group?.appointments.findIndex((a) => a.key === key) ?? -1;
  if (!group || index < 0) throw new Error(`No seed appointment ${key} in group ${groupId}`);
  return group.id(index);
};

/** Where a seed appointment starts and ends (ISO 8601), relative to `now`. */
export const timesOf = (a: SeedAppointment, now: number) => {
  const start = occurredAtOf(
    { author: a.author, kind: a.kind, at: { daysAgo: -a.daysAhead, time: a.time } },
    now,
  );
  return {
    occurredAt: start.toISOString(),
    endsAt: a.minutes ? new Date(start.getTime() + a.minutes * 60_000).toISOString() : null,
  };
};

/** The provider id for a key in a group's seeded directory. */
const providerIdIn = (groupId: string, key: string) => {
  const group = PROVIDER_GROUPS.find((g) => g.groupId === groupId);
  const index = group?.providers.findIndex((p) => p.key === key) ?? -1;
  if (!group || index < 0) throw new Error(`Seed appointment is with a missing provider: ${key}`);
  return group.providerId(index);
};

/** Every seed appointment as rows (content columns as the content schema takes them), links and documents. */
export const seedRows = (now: number) =>
  GROUPS.map(({ groupId, recipientId, appointments, id }) => {
    const idByKey = new Map(appointments.map((a, i) => [a.key, id(i)]));
    const rows = appointments.map((a, i) => {
      const { occurredAt, endsAt } = timesOf(a, now);
      const rescheduledTo = a.cancelled?.rescheduledTo ? idByKey.get(a.cancelled.rescheduledTo) : null;
      if (a.cancelled?.rescheduledTo && !rescheduledTo)
        throw new Error(`Seed appointment ${a.key} moves to a missing one: ${a.cancelled.rescheduledTo}`);
      // Cancelled a day before (or, for a past visit, an hour before) it was due.
      const cancelledAt = a.cancelled
        ? new Date(Math.min(now - DAY, new Date(occurredAt).getTime() - HOUR)).toISOString()
        : null;
      return {
        id: id(i),
        groupId,
        recipientId,
        author: a.author,
        content: {
          kind: a.kind,
          occurredAt,
          timeZone: TIME_ZONE,
          title: a.title ?? null,
          body: null,
          details: null,
          allDay: a.allDay ?? false,
          endsAt,
          place: a.place ?? null,
          cancelledAt,
          cancelReason: a.cancelled?.reason ?? null,
          rescheduledTo: rescheduledTo ?? null,
        },
        text: a.text ?? "",
      };
    });
    const links = appointments.flatMap((a, i) =>
      (a.with ?? []).map((key) => {
        const providerId = providerIdIn(groupId, key);
        return { id: entryProviderId(id(i), providerId), groupId, entryId: id(i), providerId };
      }),
    );
    return { rows, links };
  });

export const seed = async () => {
  const db = getDb();
  const authors = [...new Set(GROUPS.flatMap((g) => g.appointments.map((a) => a.author)))];
  const users = await db
    .select({ id: userSchema.id, email: userSchema.email })
    .from(userSchema)
    .where(inArray(userSchema.email, authors));
  const idByEmail = new Map(users.map((u) => [u.email, u.id]));

  const now = Date.now();
  // Written two days ago, so nobody shows as typing.
  const writtenAt = new Date(now - 2 * DAY).toISOString();
  for (const { rows, links } of seedRows(now)) {
    // Replacements first: a rescheduled event points at its new one.
    const ordered = [...rows].sort(
      (a, b) => Number(!!a.content.rescheduledTo) - Number(!!b.content.rescheduledTo),
    );
    for (const { id, groupId, recipientId, author, content, text } of ordered) {
      const authorId = idByEmail.get(author);
      if (!authorId) continue;
      const audits = { createdBy: authorId, updatedBy: authorId };
      await db
        .insert(timelineEntrySchema)
        .values({
          id,
          groupId,
          recipientId,
          ...content,
          cancelledBy: content.cancelledAt ? authorId : null,
          createdAt: writtenAt,
          updatedAt: writtenAt,
          ...audits,
        })
        .onConflictDoNothing({ target: timelineEntrySchema.id });
      const doc = noteDocFromText(text);
      await db
        .insert(noteDocumentSchema)
        .values({
          id,
          groupId,
          subject: "entry",
          entryId: id,
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
    const authorOf = new Map(rows.map((r) => [r.id, idByEmail.get(r.author)]));
    for (const link of links) {
      const authorId = authorOf.get(link.entryId);
      if (!authorId) continue;
      await db
        .insert(timelineEntryProviderSchema)
        .values({ ...link, createdBy: authorId, updatedBy: authorId })
        .onConflictDoNothing({ target: timelineEntryProviderSchema.id });
    }
  }
};
