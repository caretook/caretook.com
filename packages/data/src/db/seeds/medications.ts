import type {
  DoseStatus,
  MedicationChangeDetails,
  MedicationContent,
  MedicationContentInput,
  DoseDetails,
} from "../schema";

import { inArray } from "drizzle-orm";
import { getDb } from "../client";
import {
  encodeNoteDoc,
  medicationChange,
  medicationChangeId,
  medicationContentZSchema,
  medicationSchema,
  noteDocFromText,
  noteDocumentSchema,
  normalizeSchedule,
  noteText,
  slotTimes,
  timelineEntrySchema,
  userSchema,
} from "../schema";
import { DEV_GROUP_ID, DEV_RECIPIENT_ID } from "./careGroups";
import { DEV_FAMILY_PASS_IDS, seedPassRows } from "./medicationPasses";
import { SEED_GROUPS as PROVIDER_GROUPS } from "./providers";
import { SECOND_GROUP_ID, SECOND_RECIPIENT_ID } from "./secondGroup";
import { occurredAtOf } from "./timelineEntries";

// Fictional medication lists for both seeded groups: Grandma Pat's (four
// current, one completed course, one discontinued for side effects), about
// a week of her doses, and the change entries each save would have written;
// and one medication for Grandpa Lou. Everything here is made up.
//
// Grandma Pat's scheduled medications are in Dev Family's seeded passes
// (Morning 08:00, Evening 20:00, `medicationPasses.ts`), with Latanoprost at
// bedtime and Amoxicillin's midday dose as times of their own; her doses in a
// pass name it (`passId`) as well as the time (`scheduledFor`).
//
// Their own ids, following list order (append only):
//   …3f1d2b9a… Dev Family's medications     …3f1d2b9b… Dev Family 2's
//   …3f1d2b9c… Dev Family's dose entries
// Change entries get the id the service derives (`medicationChangeId`).

const TIME_ZONE = "America/Los_Angeles";
type Author = "member@example.com" | "caretaker@example.com";
type LocalTime = `${number}:${number}`;
type When = { daysAgo: number; time: LocalTime };

/** A later save: what it changed, and when. */
type SeedSave = When & { author: Author; patch: Partial<MedicationContentInput> };

export type SeedMedication = {
  /** A key doses refer to. */
  key: string;
  /** When it was added (its "started" entry), and by whom. */
  added: When & { author: Author };
  /** Its content when added. `startedOn` is the day it was added. */
  content: Omit<MedicationContentInput, "prescriberId" | "pharmacyId" | "startedOn">;
  /** Keys of the group's seeded providers. */
  prescriber?: string;
  pharmacy?: string;
  /** Saves since, oldest first. `stoppedOn` and `lastFilledOn` are filled from `stoppedDaysAgo` and `filledDaysAgo`. */
  saves?: (SeedSave & { stoppedDaysAgo?: number; filledDaysAgo?: number })[];
  /** Shared live notes about it (one paragraph per line). */
  notes?: string;
};

const { morning: MORNING_PASS, evening: EVENING_PASS } = DEV_FAMILY_PASS_IDS;

/** Grandma Pat's medications (Dev Family). */
export const DEV_FAMILY_MEDICATIONS: SeedMedication[] = [
  {
    key: "lisinopril",
    added: { daysAgo: 120, time: "10:15", author: "member@example.com" },
    content: {
      name: "Lisinopril",
      strength: "5 mg",
      form: "tablet",
      dose: "1 tablet",
      directions: "Once every morning, with or without food.",
      reason: "Blood pressure",
      schedule: { type: "scheduled", slots: [{ passId: MORNING_PASS }] },
    },
    prescriber: "alvarez",
    pharmacy: "cornerstone",
    saves: [
      {
        daysAgo: 5,
        time: "16:40",
        author: "member@example.com",
        patch: { strength: "10 mg" },
      },
    ],
  },
  {
    key: "metformin",
    added: { daysAgo: 300, time: "09:00", author: "member@example.com" },
    content: {
      name: "Metformin",
      strength: "500 mg",
      form: "tablet",
      dose: "1 tablet",
      directions: "Twice a day with meals.",
      reason: "Type 2 diabetes",
      schedule: { type: "scheduled", slots: [{ passId: MORNING_PASS }, { passId: EVENING_PASS }] },
    },
    prescriber: "alvarez",
    pharmacy: "cornerstone",
    notes: [
      "Always with food: an empty stomach upsets it.",
      "The tablets are large. Crush into applesauce if she has trouble swallowing.",
      "Cornerstone needs 3 days' notice for refills.",
    ].join("\n"),
  },
  {
    key: "acetaminophen",
    added: { daysAgo: 90, time: "14:30", author: "caretaker@example.com" },
    content: {
      name: "Acetaminophen",
      strength: "500 mg",
      form: "tablet",
      dose: "2 tablets",
      directions: "For knee pain. At least 6 hours between doses.",
      reason: "Knee pain",
      schedule: { type: "asNeeded", maxPerDay: 6 },
    },
    saves: [
      {
        daysAgo: 10,
        time: "11:05",
        author: "member@example.com",
        patch: { schedule: { type: "asNeeded", maxPerDay: 4 } },
      },
    ],
  },
  {
    key: "latanoprost",
    added: { daysAgo: 200, time: "13:20", author: "member@example.com" },
    content: {
      name: "Latanoprost",
      strength: "0.005%",
      form: "drops",
      dose: "1 drop in each eye",
      directions: "At bedtime. Wait 5 minutes before any other eye drops.",
      reason: "Eye pressure",
      schedule: { type: "scheduled", slots: [{ time: "21:00" }] },
    },
    pharmacy: "cornerstone",
    saves: [
      {
        // A refill: nothing the timeline records.
        daysAgo: 4,
        time: "15:10",
        author: "caretaker@example.com",
        filledDaysAgo: 4,
        patch: { quantity: "1 bottle (2.5 mL)", refillsLeft: 3, rxNumber: "RX 0104-2277" },
      },
    ],
  },
  {
    key: "amoxicillin",
    added: { daysAgo: 24, time: "17:30", author: "member@example.com" },
    content: {
      name: "Amoxicillin",
      strength: "500 mg",
      form: "capsule",
      dose: "1 capsule",
      directions: "Three times a day for 10 days. Finish the whole course.",
      reason: "Chest infection",
      schedule: {
        type: "scheduled",
        slots: [{ passId: MORNING_PASS }, { time: "14:00" }, { passId: EVENING_PASS }],
      },
    },
    prescriber: "alvarez",
    pharmacy: "cornerstone",
    saves: [
      {
        daysAgo: 14,
        time: "20:30",
        author: "caretaker@example.com",
        stoppedDaysAgo: 14,
        patch: { status: "completed" },
      },
    ],
  },
  {
    key: "oxybutynin",
    added: { daysAgo: 60, time: "11:45", author: "member@example.com" },
    content: {
      name: "Oxybutynin",
      strength: "5 mg",
      form: "tablet",
      dose: "1 tablet",
      directions: "Twice a day.",
      reason: "Bladder urgency",
      schedule: { type: "scheduled", slots: [{ passId: MORNING_PASS }, { passId: EVENING_PASS }] },
    },
    prescriber: "alvarez",
    saves: [
      {
        daysAgo: 20,
        time: "09:50",
        author: "member@example.com",
        stoppedDaysAgo: 20,
        patch: {
          status: "discontinued",
          stopReason: "sideEffects",
          stopNote: "Dry mouth, and more confused in the evenings.",
        },
      },
    ],
  },
];

/** Grandpa Lou's one medication (Dev Family 2), so the groups' lists stay separate. */
export const SECOND_GROUP_MEDICATIONS: SeedMedication[] = [
  {
    key: "tamsulosin",
    added: { daysAgo: 150, time: "10:00", author: "member@example.com" },
    content: {
      name: "Tamsulosin",
      strength: "0.4 mg",
      form: "capsule",
      dose: "1 capsule",
      directions: "Once a day, half an hour after dinner.",
      reason: "Prostate",
      schedule: { type: "scheduled", slots: [{ time: "19:00" }] },
    },
  },
];

// ---------------------------------------------------------------------------
// Doses: about a week for Dev Family's current medications.
// ---------------------------------------------------------------------------

export type SeedDose = When & {
  medication: string;
  author: Author;
  status: DoseStatus;
  scheduledFor?: LocalTime;
  /** The pass the slot is in, when it's in one. */
  passId?: string;
  note?: string;
};

const DOSE_DAYS = 7;

/** Doses that weren't simply given, by "<medication> <daysAgo> <slot>". */
const EXCEPTIONS: Record<string, { status: DoseStatus; note: string }> = {
  "metformin 6 08:00": { status: "refused", note: "Upset stomach. Didn't want it." },
  "metformin 3 20:00": { status: "skipped", note: "Asleep by 7. Didn't wake her." },
  "latanoprost 5 21:00": { status: "skipped", note: "Bottle ran out. Refill picked up the next day." },
  "lisinopril 2 08:00": {
    status: "skipped",
    note: "Blood pressure was low this morning. Nurse line said to skip.",
  },
};

/** Slots still ahead on a normal day: today's are left for someone to log. */
const EVENING_HOURS = "18:00";

/** Dev Family's seeded passes: where its pass slots fall. */
const DEV_FAMILY_PASSES = seedPassRows().filter((p) => p.groupId === DEV_GROUP_ID);

const scheduledDoses = (): SeedDose[] => {
  const doses: SeedDose[] = [];
  for (let daysAgo = DOSE_DAYS; daysAgo >= 0; daysAgo--) {
    for (const key of ["lisinopril", "metformin", "latanoprost"]) {
      const medication = DEV_FAMILY_MEDICATIONS.find((m) => m.key === key);
      const schedule = normalizeSchedule(medication?.content.schedule);
      if (schedule?.type !== "scheduled") continue;
      for (const { time, passId } of slotTimes(schedule, DEV_FAMILY_PASSES)) {
        const slot = time as LocalTime;
        if (daysAgo === 0 && slot >= EVENING_HOURS) continue;
        const exception = EXCEPTIONS[`${key} ${daysAgo} ${slot}`];
        // A few minutes after the slot, never the same twice in a row.
        const late = (doses.length * 7) % 25;
        const [h, m] = slot.split(":").map(Number);
        doses.push({
          medication: key,
          daysAgo,
          time: `${h ?? 0}:${String((m ?? 0) + late).padStart(2, "0")}` as LocalTime,
          author: doses.length % 3 === 0 ? "member@example.com" : "caretaker@example.com",
          status: exception?.status ?? "given",
          scheduledFor: slot,
          ...(passId && { passId }),
          note: exception?.note,
        });
      }
    }
  }
  return doses;
};

const AS_NEEDED_DOSES: SeedDose[] = [
  {
    medication: "acetaminophen",
    daysAgo: 6,
    time: "14:10",
    author: "caretaker@example.com",
    status: "given",
  },
  {
    medication: "acetaminophen",
    daysAgo: 4,
    time: "09:30",
    author: "caretaker@example.com",
    status: "given",
    note: "Knee stiff after the walk.",
  },
  { medication: "acetaminophen", daysAgo: 4, time: "16:45", author: "member@example.com", status: "given" },
  {
    medication: "acetaminophen",
    daysAgo: 1,
    time: "11:20",
    author: "caretaker@example.com",
    status: "given",
  },
];

/** Dev Family's doses, in id order: the scheduled week, then the as-needed ones. Append only. */
export const DEV_FAMILY_DOSES: SeedDose[] = [...scheduledDoses(), ...AS_NEEDED_DOSES];

// ---------------------------------------------------------------------------
// Rows
// ---------------------------------------------------------------------------

const devFamilyMedicationId = (index: number) =>
  `0b6f3c1e-5d1a-4c2e-9a77-3f1d2b9a${String(1001 + index).padStart(4, "0")}`;
const secondGroupMedicationId = (index: number) =>
  `0b6f3c1e-5d1a-4c2e-9a77-3f1d2b9b${String(1001 + index).padStart(4, "0")}`;
export const doseEntryId = (index: number) =>
  `0b6f3c1e-5d1a-4c2e-9a77-3f1d2b9c${String(1001 + index).padStart(4, "0")}`;

type SeedGroup = {
  groupId: string;
  recipientId: string;
  medications: SeedMedication[];
  medicationId: (index: number) => string;
  doses: SeedDose[];
};

export const SEED_GROUPS: SeedGroup[] = [
  {
    groupId: DEV_GROUP_ID,
    recipientId: DEV_RECIPIENT_ID,
    medications: DEV_FAMILY_MEDICATIONS,
    medicationId: devFamilyMedicationId,
    doses: DEV_FAMILY_DOSES,
  },
  {
    groupId: SECOND_GROUP_ID,
    recipientId: SECOND_RECIPIENT_ID,
    medications: SECOND_GROUP_MEDICATIONS,
    medicationId: secondGroupMedicationId,
    doses: [],
  },
];

const timeOf = (when: When, now: number) =>
  occurredAtOf({ at: when, author: "member@example.com", kind: "dose" }, now).toISOString();

/** The calendar day (in the seeds' zone) `daysAgo` days back. */
const dayOf = (daysAgo: number, now: number) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(
    new Date(timeOf({ daysAgo, time: "12:00" }, now)),
  );

type SeedEntryRow = {
  id: string;
  groupId: string;
  recipientId: string;
  kind: "dose" | "medicationChange";
  occurredAt: string;
  timeZone: string;
  title: null;
  body: null;
  details: DoseDetails | MedicationChangeDetails;
  author: Author;
};

/**
 * Every group's medications as rows, with the change entries their saves
 * would have written (worked out by `medicationChange`, like the service),
 * their doses and their notes. Ids resolved; authors still by email.
 */
export const seedRows = (now = Date.now()) =>
  SEED_GROUPS.map(({ groupId, recipientId, medications, medicationId, doses }) => {
    const providers = PROVIDER_GROUPS.find((g) => g.groupId === groupId);
    const providerIdOf = (key: string | undefined) => {
      if (!key) return null;
      const index = providers?.providers.findIndex((p) => p.key === key) ?? -1;
      if (index < 0 || !providers) throw new Error(`Seed medication names a missing provider: ${key}`);
      return providers.providerId(index);
    };
    const parse = (content: MedicationContentInput): MedicationContent =>
      medicationContentZSchema.parse(content);

    const changes: SeedEntryRow[] = [];
    const rows = medications.map((medication, index) => {
      const id = medicationId(index);
      const record = (
        before: MedicationContent | null,
        after: MedicationContent,
        at: string,
        author: Author,
      ) => {
        const change = medicationChange(before, after);
        if (!change) return;
        changes.push({
          id: medicationChangeId(id, at),
          groupId,
          recipientId,
          kind: "medicationChange",
          occurredAt: at,
          timeZone: TIME_ZONE,
          title: null,
          body: null,
          details: { medicationId: id, ...change },
          author,
        });
      };

      const createdAt = timeOf(medication.added, now);
      let content = parse({
        ...medication.content,
        startedOn: dayOf(medication.added.daysAgo, now),
        prescriberId: providerIdOf(medication.prescriber),
        pharmacyId: providerIdOf(medication.pharmacy),
      });
      record(null, content, createdAt, medication.added.author);

      let updatedAt = createdAt;
      let updatedBy = medication.added.author;
      for (const { patch, author, stoppedDaysAgo, filledDaysAgo, ...when } of medication.saves ?? []) {
        const next = parse({
          ...content,
          ...patch,
          ...(stoppedDaysAgo !== undefined && { stoppedOn: dayOf(stoppedDaysAgo, now) }),
          ...(filledDaysAgo !== undefined && { lastFilledOn: dayOf(filledDaysAgo, now) }),
        });
        updatedAt = timeOf(when, now);
        updatedBy = author;
        record(content, next, updatedAt, author);
        content = next;
      }

      return {
        id,
        groupId,
        recipientId,
        ...content,
        createdAt,
        updatedAt,
        createdByEmail: medication.added.author,
        updatedByEmail: updatedBy,
      };
    });

    const idByKey = new Map(medications.map((m, i) => [m.key, medicationId(i)]));
    const allDoses: SeedEntryRow[] = doses.map((dose, index) => {
      const medication = medications.find((m) => m.key === dose.medication);
      const id = idByKey.get(dose.medication);
      if (!medication || !id) throw new Error(`Seed dose names a missing medication: ${dose.medication}`);
      return {
        id: doseEntryId(index),
        groupId,
        recipientId,
        kind: "dose",
        occurredAt: timeOf(dose, now),
        timeZone: TIME_ZONE,
        title: null,
        body: null,
        details: {
          medicationId: id,
          status: dose.status,
          ...(dose.status === "given" && medication.content.dose ? { amount: medication.content.dose } : {}),
          ...(dose.scheduledFor ? { scheduledFor: dose.scheduledFor } : {}),
          ...(dose.passId ? { passId: dose.passId } : {}),
          ...(dose.note ? { note: dose.note } : {}),
        },
        author: dose.author,
      };
    });
    // Seeded early in the day, this morning's slots are still ahead: nobody has logged them yet.
    const doseRows = allDoses.filter((dose) => Date.parse(dose.occurredAt) <= now);

    const notes = medications.flatMap((m, i) =>
      m.notes ? [{ id: medicationId(i), groupId, text: m.notes, author: m.added.author }] : [],
    );
    return { rows, changes, doses: doseRows, notes };
  });

export const seed = async () => {
  const db = getDb();
  const users = await db
    .select({ id: userSchema.id, email: userSchema.email })
    .from(userSchema)
    .where(inArray(userSchema.email, ["member@example.com", "caretaker@example.com"]));
  const idByEmail = new Map(users.map((u) => [u.email, u.id]));
  const owner = idByEmail.get("member@example.com");
  if (!owner) return;
  const userId = (email: Author) => idByEmail.get(email) ?? owner;

  for (const { rows, changes, doses, notes } of seedRows()) {
    for (const { createdByEmail, updatedByEmail, ...row } of rows) {
      await db
        .insert(medicationSchema)
        .values({ ...row, createdBy: userId(createdByEmail), updatedBy: userId(updatedByEmail) })
        .onConflictDoNothing({ target: medicationSchema.id });
    }

    const entries = [...changes, ...doses].map(({ author, ...entry }) => ({
      ...entry,
      createdAt: entry.occurredAt,
      updatedAt: entry.occurredAt,
      createdBy: userId(author),
      updatedBy: userId(author),
    }));
    for (let i = 0; i < entries.length; i += 200) {
      await db
        .insert(timelineEntrySchema)
        .values(entries.slice(i, i + 200))
        .onConflictDoNothing({ target: timelineEntrySchema.id });
    }

    // Shared notes: live documents owned by the medication, already
    // compacted, last edited a few days ago (so nobody shows as typing).
    const edited = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    for (const note of notes) {
      const doc = noteDocFromText(note.text);
      await db
        .insert(noteDocumentSchema)
        .values({
          id: note.id,
          groupId: note.groupId,
          subject: "medication",
          medicationId: note.id,
          snapshot: encodeNoteDoc(doc),
          text: noteText(doc),
          editors: { [userId(note.author)]: edited },
          createdAt: edited,
          updatedAt: edited,
          createdBy: userId(note.author),
          updatedBy: userId(note.author),
        })
        .onConflictDoNothing({ target: noteDocumentSchema.id });
      doc.destroy();
    }
  }
};
