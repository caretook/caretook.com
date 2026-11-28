import type { GroupRoleName } from "../../constants/roles";
import type {
  AppointmentSeriesContentInput,
  ContactValues,
  DoseStatus,
  InsurancePlan,
  MedicationContentInput,
  OutsideContact,
  SharedField,
  UserInsert,
} from "../schema";
import type { SeedEntry } from "./timelineEntries";
import type { SeedProvider } from "./providers";

import { seedPasswordHash } from "./accounts";
import { inArray } from "drizzle-orm";
import { SYSTEM_USER } from "../../constants";
import { getDb } from "../client";
import {
  accountSchema,
  addDays,
  appointmentSeriesSchema,
  careGroupMemberSchema,
  careGroupSchema,
  careRecipientDetailsSchema,
  careRecipientSchema,
  dayInZone,
  encodeNoteDoc,
  entryProviderId,
  localDate,
  medicationChange,
  medicationChangeId,
  medicationContentZSchema,
  medicationPassSchema,
  medicationSchema,
  memberContactShareSchema,
  noteDocFromText,
  noteDocumentSchema,
  noteText,
  providerSchema,
  recipientAllergySchema,
  recipientConditionSchema,
  SERIES_AHEAD_DAYS,
  seriesVisitId,
  sharedContact,
  sharesAnything,
  timelineEntryProviderSchema,
  timelineEntrySchema,
  todoSchema,
  userContactSchema,
  userSchema,
} from "../schema";
import { seriesVisits } from "../../domain/appointments/seriesVisits";
import { seedProviderContent } from "./providers";
import { occurredAtOf, seedContentOf } from "./timelineEntries";

// "Tedder Family": a care group with normal, everyday activity, beside
// Grandma Pat's heavy use (Dev Family). Grandpa Hal's timeline is quieter but
// goes back about six months, with gaps of days and a few longer breaks;
// providers, medications and passes are fully set up; the profile is mostly
// filled in; a few upcoming events with one repeating series; todos mostly
// undated. Everything is made up: 555-01xx numbers, @example.com addresses.
//
// Its own users (tedder@ owns it, tedderhelper@ is its caretaker), in no other
// group, and no test reads this group: it is for trying the app by hand. The
// existing seed users' memberships don't change.
//
// Own ids (…3f1d2c<range><nnnn>), following list order: append only.
//   00 group, recipient, details   10 entries      20 providers
//   30 medications                 31 dose entries 40 passes
//   50 appointments                51 series       60 todos
//   70 profile rows (contacts, allergies, conditions)

const TIME_ZONE = "America/Los_Angeles";
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const seedAudits = { createdBy: SYSTEM_USER.id, updatedBy: SYSTEM_USER.id };

const OWNER = "tedder@example.com";
const HELPER = "tedderhelper@example.com";

export const TEDDER_USERS = [
  { email: OWNER, name: "Dev Tedder" },
  { email: HELPER, name: "Dev Tedder Helper" },
] as const satisfies readonly Pick<UserInsert, "email" | "name">[];

type Email = (typeof TEDDER_USERS)[number]["email"];
type LocalTime = `${number}:${number}`;

const tedderId = (range: string, n: number) =>
  `0b6f3c1e-5d1a-4c2e-9a77-3f1d2c${range}${String(n).padStart(4, "0")}`;
export const TEDDER_GROUP_ID = tedderId("00", 1);
export const TEDDER_RECIPIENT_ID = tedderId("00", 2);
const DETAILS_ID = tedderId("00", 3);
const entryId = (i: number) => tedderId("10", 1001 + i);
const providerId = (i: number) => tedderId("20", 1001 + i);
const medicationId = (i: number) => tedderId("30", 1001 + i);
const doseId = (i: number) => tedderId("31", 1001 + i);
const passId = (i: number) => tedderId("40", 1001 + i);
const appointmentId = (i: number) => tedderId("50", 1001 + i);
const seriesId = (i: number) => tedderId("51", 1001 + i);
const todoId = (i: number) => tedderId("60", 1001 + i);
const profileId = (i: number) => tedderId("70", 1001 + i);

// ---------------------------------------------------------------------------
// Group, members, profile
// ---------------------------------------------------------------------------

export const TEDDER_RECIPIENT = {
  name: "Hal Tedder",
  preferredName: "Grandpa Hal",
  dateOfBirth: "1940-09-23",
  timeZone: TIME_ZONE,
  codeStatus: "fullCode",
  bloodType: "A+",
  primaryLanguage: "English",
  pronouns: "he/him",
  notes:
    "Wears hearing aids: speak clearly, face him. Walks with a cane outside. Coffee black, one cup a day.",
} as const;

const INSURANCE: InsurancePlan[] = [
  {
    id: profileId(0),
    rank: "primary",
    insurer: "Medicare",
    planName: "Part A and B",
    memberId: "3TH8-KD2-QX41",
    groupNumber: null,
    phone: "(555) 010-7100",
  },
  {
    id: profileId(1),
    rank: "secondary",
    insurer: "Example Senior Health",
    planName: "Supplement Plan N",
    memberId: "ESH-902215-03",
    groupNumber: "GRP-71840",
    phone: "(555) 010-7110",
  },
];

const OUTSIDE_CONTACTS: OutsideContact[] = [
  {
    id: profileId(2),
    name: "Gus Example",
    relationship: "Neighbour",
    phone: "(555) 010-7420",
    emergencyRank: 3,
  },
];

export const TEDDER_DETAILS = {
  phones: [{ label: "Home", number: "(555) 010-7231" }],
  email: "hal.tedder@example.com",
  // Address left out: "mostly" filled in.
  address: null,
  insurance: INSURANCE,
  outsideContacts: OUTSIDE_CONTACTS,
};

type SeedMember = {
  email: Email;
  role: GroupRoleName;
  relationship: string;
  contactId: string;
  contact: ContactValues;
  sharedFields: SharedField[];
  emergencyRank: number | null;
  isPrimaryContact: boolean;
};

export const TEDDER_MEMBERS: SeedMember[] = [
  {
    email: OWNER,
    role: "owner",
    relationship: "Daughter",
    contactId: profileId(3),
    contact: {
      phones: [{ label: "Mobile", number: "(555) 010-7001" }],
      contactEmail: "dev.tedder.contact@example.com",
      address: "9 Example Lane\nSpringfield, CA 90000",
    },
    sharedFields: ["phones", "email"],
    emergencyRank: 1,
    isPrimaryContact: true,
  },
  {
    email: HELPER,
    role: "caretaker",
    relationship: "Grandson",
    contactId: profileId(4),
    contact: { phones: [{ label: "Mobile", number: "(555) 010-7002" }], contactEmail: null, address: null },
    sharedFields: ["phones"],
    emergencyRank: 2,
    isPrimaryContact: false,
  },
];

export const TEDDER_ALLERGIES = [
  { id: profileId(5), substance: "Penicillin", reaction: "Hives", severity: "moderate" as const },
  { id: profileId(6), substance: "Shellfish", reaction: "Swollen lips", severity: "mild" as const },
];

export const TEDDER_CONDITIONS = [
  { id: profileId(7), name: "High blood pressure", status: "active" as const, sinceYear: 2010 },
  {
    id: profileId(8),
    name: "High cholesterol",
    status: "active" as const,
    sinceYear: 2014,
    note: "Diet and a statin",
  },
  { id: profileId(9), name: "Osteoarthritis (knees)", status: "active" as const, sinceYear: 2020 },
];

// ---------------------------------------------------------------------------
// Providers
// ---------------------------------------------------------------------------

export const TEDDER_PROVIDERS: SeedProvider[] = [
  {
    key: "oakview",
    type: "practice",
    name: "Oakview Medical Group",
    specialty: "Primary care",
    phones: [
      { label: "Front desk", number: "(555) 010-7300" },
      { label: "Nurse line", number: "(555) 010-7310" },
    ],
    address: "220 Oakview Blvd\nSpringfield, CA 90000",
    website: "oakviewmedical.example",
    isPrimary: true,
  },
  {
    key: "brooks",
    type: "clinician",
    name: "Dr. Nina Brooks",
    specialty: "Family medicine",
    practice: "oakview",
    phones: [{ label: "Office", number: "(555) 010-7300 x120" }],
    isPrimary: true,
    notes: "Likes a short list of questions at the start of the visit.",
  },
  {
    key: "lindqvist",
    type: "clinician",
    name: "Dr. Erik Lindqvist",
    specialty: "Orthopedics",
    phones: [{ label: "Office", number: "(555) 010-7350" }],
    address: "15 Bayside Plaza, Suite 4\nSpringfield, CA 90000",
  },
  {
    key: "audiology",
    type: "other",
    name: "Clearsound Audiology",
    specialty: "Hearing aids",
    phones: [{ label: "Office", number: "(555) 010-7380" }],
  },
  {
    key: "parkside",
    type: "pharmacy",
    name: "Parkside Pharmacy",
    phones: [{ label: "Pharmacy", number: "(555) 010-7400" }],
    address: "88 Park St\nSpringfield, CA 90000",
    isPrimary: true,
    notes: "Auto-refill is on for the Lisinopril and Atorvastatin.",
  },
];

// ---------------------------------------------------------------------------
// Passes and medications
// ---------------------------------------------------------------------------

export const TEDDER_PASSES = [
  { name: "Breakfast", time: "08:00" },
  { name: "Lunch", time: "12:30" },
  { name: "Dinner", time: "18:00" },
  { name: "Bedtime", time: "21:30" },
] as const;
const PASS = { breakfast: passId(0), lunch: passId(1), dinner: passId(2), bedtime: passId(3) };

type SeedMedication = {
  key: string;
  daysAgo: number;
  author: Email;
  content: Omit<MedicationContentInput, "prescriberId" | "pharmacyId" | "startedOn">;
  prescriber?: string;
  pharmacy?: string;
};

export const TEDDER_MEDICATIONS: SeedMedication[] = [
  {
    key: "lisinopril",
    daysAgo: 170,
    author: OWNER,
    content: {
      name: "Lisinopril",
      type: "prescription",
      strength: "10 mg",
      form: "tablet",
      dose: "1 tablet",
      directions: "Once every morning.",
      reason: "Blood pressure",
      schedule: { type: "scheduled", slots: [{ passId: PASS.breakfast }] },
    },
    prescriber: "brooks",
    pharmacy: "parkside",
  },
  {
    key: "atorvastatin",
    daysAgo: 170,
    author: OWNER,
    content: {
      name: "Atorvastatin",
      type: "prescription",
      strength: "20 mg",
      form: "tablet",
      dose: "1 tablet",
      directions: "At bedtime.",
      reason: "Cholesterol",
      schedule: { type: "scheduled", slots: [{ passId: PASS.bedtime }] },
    },
    prescriber: "brooks",
    pharmacy: "parkside",
  },
  {
    key: "calcium",
    daysAgo: 120,
    author: HELPER,
    content: {
      name: "Calcium with vitamin D",
      type: "supplement",
      strength: "600 mg",
      form: "tablet",
      dose: "1 tablet",
      directions: "With lunch and dinner.",
      schedule: { type: "scheduled", slots: [{ passId: PASS.lunch }, { passId: PASS.dinner }] },
    },
  },
  {
    key: "acetaminophen",
    daysAgo: 60,
    author: OWNER,
    content: {
      name: "Acetaminophen",
      type: "otc",
      strength: "500 mg",
      form: "tablet",
      dose: "2 tablets",
      directions: "For knee pain. At least 6 hours apart.",
      reason: "Knee pain",
      schedule: { type: "asNeeded", maxPerDay: 4 },
    },
    prescriber: "lindqvist",
  },
];

/** Scheduled doses for the last few days: given, with one skip. */
const DOSE_DAYS = 3;
const SCHEDULED_KEYS = ["lisinopril", "calcium", "atorvastatin"];
const SKIPPED = "calcium 2 18:00";

// ---------------------------------------------------------------------------
// Timeline: about six months, quieter than Dev Family
// ---------------------------------------------------------------------------

type TedderEntry = Omit<SeedEntry, "author"> & { author: Email };

/** Quiet stretches (days ago, inclusive): a trip, a cold, family visiting. */
const BREAKS: [number, number][] = [
  [12, 18],
  [41, 47],
  [77, 88],
  [118, 124],
  [150, 157],
];
const HISTORY_DAYS = 180;

const NOTES = [
  "Good day. Read the paper on the porch.",
  "Watched the game with the neighbours.",
  "Ate well at dinner. Asked for seconds.",
  "Walked around the block twice.",
  "A bit tired this afternoon, napped an hour.",
  "Called his brother. In good spirits after.",
  "Worked on the model boat for a while.",
  "Slept well, up at 7.",
  "Forgot the hearing aids on the walk. Fine otherwise.",
  "Grocery run together. He picked the soup.",
];
const SYMPTOMS: { name: string; severity: number; body?: string }[] = [
  { name: "Knee pain", severity: 4, body: "Right knee, after the stairs." },
  { name: "Knee pain", severity: 3 },
  { name: "Back stiffness", severity: 2, body: "In the morning, eased by lunch." },
  { name: "Headache", severity: 2 },
];
const EVENTS = ["Haircut", "Lunch out with family", "Hearing aid cleaning", "Church potluck", "Library trip"];

/** A fixed pseudo-random sequence, so every seed writes the same history. */
const historyEntries = (): TedderEntry[] => {
  let state = 19400923;
  const rand = () => (state = (state * 1103515245 + 12345) % 2147483648) / 2147483648;
  const pick = <T>(list: readonly T[]) => list[Math.floor(rand() * list.length)] as T;
  const out: TedderEntry[] = [];
  for (let day = 1; day <= HISTORY_DAYS; day++) {
    if (BREAKS.some(([from, to]) => day >= from && day <= to)) continue;
    // Most days have nothing; some one entry, a few two.
    const r = rand();
    const count = r < 0.55 ? 0 : r < 0.9 ? 1 : 2;
    for (let n = 0; n < count; n++) {
      const author = rand() < 0.6 ? OWNER : HELPER;
      const hour = n === 0 ? 10 + Math.floor(rand() * 4) : 17 + Math.floor(rand() * 3);
      const at = {
        daysAgo: day,
        time: `${hour}:${String(Math.floor(rand() * 60)).padStart(2, "0")}` as LocalTime,
      };
      const kind = rand();
      if (kind < 0.45) out.push({ at, author, kind: "note", body: pick(NOTES) });
      else if (kind < 0.75) {
        out.push({
          at,
          author,
          kind: "vital",
          details: {
            readings: [
              {
                type: "bloodPressure",
                systolic: Math.round(124 + rand() * 14),
                diastolic: Math.round(76 + rand() * 10),
              },
              { type: "heartRate", value: Math.round(62 + rand() * 12) },
            ],
          },
        });
      } else if (kind < 0.9) {
        const s = pick(SYMPTOMS);
        out.push({
          at,
          author,
          kind: "symptom",
          details: { name: s.name, severity: s.severity },
          body: s.body,
        });
      } else out.push({ at, author, kind: "event", title: pick(EVENTS) });
    }
  }
  return out;
};

/** A few hand-written moments, then the generated history. Append only. */
export const TEDDER_ENTRIES: TedderEntry[] = [
  { hoursAgo: 3, author: HELPER, kind: "note", body: "Fixed the porch light together. Chatty and cheerful." },
  {
    at: { daysAgo: 1, time: "09:10" },
    author: OWNER,
    kind: "vital",
    details: { readings: [{ type: "weight", value: 79.4 }] },
  },
  {
    at: { daysAgo: 3, time: "15:00" },
    author: OWNER,
    kind: "event",
    title: "Hearing aid check: Clearsound",
    body: "New domes fitted. Next check in six months.",
  },
  ...historyEntries(),
];

// ---------------------------------------------------------------------------
// Planner: a few upcoming events, one repeating series
// ---------------------------------------------------------------------------

type SeedAppointment = {
  key: string;
  daysAhead: number;
  time: LocalTime;
  minutes?: number;
  allDay?: boolean;
  author: Email;
  title: string;
  place?: string;
  text?: string;
  with?: string[];
};

export const TEDDER_APPOINTMENTS: SeedAppointment[] = [
  {
    key: "brooks",
    daysAhead: 5,
    time: "10:00",
    minutes: 30,
    author: OWNER,
    title: "Check-up: Dr. Brooks",
    place: "220 Oakview Blvd\nSpringfield, CA 90000",
    with: ["brooks", "oakview"],
    text: "Ask about the knee, and whether the calcium is still needed.",
  },
  {
    key: "knee",
    daysAhead: 16,
    time: "14:15",
    minutes: 45,
    author: HELPER,
    title: "Knee follow-up: Dr. Lindqvist",
    place: "15 Bayside Plaza, Suite 4\nSpringfield, CA 90000",
    with: ["lindqvist"],
  },
  {
    key: "birthday",
    daysAhead: 24,
    time: "00:00",
    allDay: true,
    author: OWNER,
    title: "Cousin Ruth's birthday lunch",
  },
];

type SeedSeries = {
  startsIn: number;
  content: Omit<AppointmentSeriesContentInput, "startsOn" | "timeZone" | "providerIds" | "toppedUpThrough">;
};

export const TEDDER_SERIES: SeedSeries[] = [
  {
    startsIn: -14,
    content: {
      kind: "event",
      rule: "FREQ=WEEKLY;INTERVAL=1;BYDAY=TH",
      startTime: "10:30",
      allDay: false,
      title: "Senior center exercise class",
      durationMinutes: 60,
      place: "Springfield Senior Center",
    },
  },
];

// ---------------------------------------------------------------------------
// Todos: mostly undated, two with a due day
// ---------------------------------------------------------------------------

type SeedTodo = {
  title: string;
  dueIn?: number;
  dueTime?: string;
  assignee?: Email;
  author: Email;
  doneDaysAgo?: number;
  doneBy?: Email;
  provider?: string;
  medication?: string;
};

export const TEDDER_TODOS: SeedTodo[] = [
  { title: "Order new hearing aid batteries", assignee: HELPER, author: OWNER, provider: "audiology" },
  { title: "Fix the loose stair rail", assignee: HELPER, author: OWNER },
  { title: "Look into a shower chair", author: OWNER },
  { title: "Update the emergency contact sheet on the fridge", author: HELPER },
  {
    title: "Ask Parkside about a 90-day supply",
    author: OWNER,
    provider: "parkside",
    medication: "atorvastatin",
  },
  { title: "Write down questions for Dr. Brooks", dueIn: 4, assignee: OWNER, author: OWNER },
  { title: "Renew the parking placard", dueIn: 9, dueTime: "12:00", assignee: OWNER, author: HELPER },
  {
    title: "Clear out the old pill bottles",
    author: HELPER,
    assignee: HELPER,
    doneDaysAgo: 6,
    doneBy: HELPER,
  },
];

// ---------------------------------------------------------------------------
// Rows
// ---------------------------------------------------------------------------

const keyIndex = <T extends { key: string }>(list: T[], key: string, what: string) => {
  const index = list.findIndex((x) => x.key === key);
  if (index < 0) throw new Error(`Tedder seed names a missing ${what}: ${key}`);
  return index;
};
const providerIdOf = (key: string) => providerId(keyIndex(TEDDER_PROVIDERS, key, "provider"));
const medicationIdOf = (key: string) => medicationId(keyIndex(TEDDER_MEDICATIONS, key, "medication"));

const whenAt = (daysAgo: number, time: LocalTime, now: number) =>
  occurredAtOf({ at: { daysAgo, time }, kind: "note" }, now).toISOString();

/** Every Tedder Family row, ids resolved; people still by email. */
export const seedRows = (now = Date.now()) => {
  const today = localDate(now, TIME_ZONE);

  const entries = TEDDER_ENTRIES.map((entry, i) => {
    const occurredAt = occurredAtOf(entry, now).toISOString();
    const { documentText, ...content } = seedContentOf(entry);
    return {
      row: {
        id: entryId(i),
        groupId: TEDDER_GROUP_ID,
        recipientId: TEDDER_RECIPIENT_ID,
        kind: entry.kind,
        occurredAt,
        timeZone: TIME_ZONE,
        ...content,
      },
      author: entry.author,
      documentText,
    };
  });

  const providers = TEDDER_PROVIDERS.map((p, i) => ({
    id: providerId(i),
    groupId: TEDDER_GROUP_ID,
    ...seedProviderContent(p, p.practice ? providerIdOf(p.practice) : null),
  }));
  const providerNotes = TEDDER_PROVIDERS.flatMap((p, i) =>
    p.notes ? [{ id: providerId(i), text: p.notes }] : [],
  );

  const passes = TEDDER_PASSES.map((pass, sortOrder) => ({
    id: passId(sortOrder),
    groupId: TEDDER_GROUP_ID,
    recipientId: TEDDER_RECIPIENT_ID,
    name: pass.name,
    time: pass.time,
    sortOrder,
  }));

  const medications = TEDDER_MEDICATIONS.map((m, i) => {
    const addedAt = whenAt(m.daysAgo, "10:00", now);
    const content = medicationContentZSchema.parse({
      ...m.content,
      startedOn: localDate(addedAt, TIME_ZONE),
      prescriberId: m.prescriber ? providerIdOf(m.prescriber) : null,
      pharmacyId: m.pharmacy ? providerIdOf(m.pharmacy) : null,
    });
    const row = {
      id: medicationId(i),
      groupId: TEDDER_GROUP_ID,
      recipientId: TEDDER_RECIPIENT_ID,
      ...content,
    };
    const change = medicationChange(null, content);
    const changeEntry = change && {
      id: medicationChangeId(row.id, addedAt),
      groupId: TEDDER_GROUP_ID,
      recipientId: TEDDER_RECIPIENT_ID,
      kind: "medicationChange" as const,
      occurredAt: addedAt,
      timeZone: TIME_ZONE,
      title: null,
      body: null,
      details: { medicationId: row.id, ...change },
    };
    return { row, changeEntry, addedAt, author: m.author };
  });

  const passTime = new Map(passes.map((p) => [p.id, p.time]));
  const doses: {
    row: {
      id: string;
      groupId: string;
      recipientId: string;
      kind: "dose";
      occurredAt: string;
      timeZone: string;
      title: null;
      body: null;
      details: {
        medicationId: string;
        status: DoseStatus;
        amount?: string;
        scheduledFor: string;
        passId: string;
      };
    };
    author: Email;
  }[] = [];
  for (let daysAgo = DOSE_DAYS; daysAgo >= 0; daysAgo--) {
    for (const key of SCHEDULED_KEYS) {
      const medication = TEDDER_MEDICATIONS[keyIndex(TEDDER_MEDICATIONS, key, "medication")];
      const schedule = medication?.content.schedule;
      if (!medication || schedule?.type !== "scheduled") continue;
      for (const slot of "slots" in schedule ? schedule.slots : []) {
        const pass = "passId" in slot ? slot.passId : undefined;
        const time = pass ? passTime.get(pass) : undefined;
        if (!pass || !time) continue;
        const status: DoseStatus = SKIPPED === `${key} ${daysAgo} ${time}` ? "skipped" : "given";
        const [h, m] = time.split(":").map(Number);
        const late = (doses.length * 5) % 20;
        const occurredAt = whenAt(
          daysAgo,
          `${h ?? 0}:${String((m ?? 0) + late).padStart(2, "0")}` as LocalTime,
          now,
        );
        doses.push({
          row: {
            id: doseId(doses.length),
            groupId: TEDDER_GROUP_ID,
            recipientId: TEDDER_RECIPIENT_ID,
            kind: "dose",
            occurredAt,
            timeZone: TIME_ZONE,
            title: null,
            body: null,
            details: {
              medicationId: medicationIdOf(key),
              status,
              ...(status === "given" && medication.content.dose ? { amount: medication.content.dose } : {}),
              scheduledFor: time,
              passId: pass,
            },
          },
          author: doses.length % 2 === 0 ? OWNER : HELPER,
        });
      }
    }
  }
  // Slots still ahead today stay open for someone to log.
  const loggedDoses = doses.filter((d) => Date.parse(d.row.occurredAt) <= now);

  const appointments = TEDDER_APPOINTMENTS.map((a, i) => {
    const start = occurredAtOf({ at: { daysAgo: -a.daysAhead, time: a.time }, kind: "event" }, now);
    return {
      id: appointmentId(i),
      author: a.author,
      content: {
        kind: "event" as const,
        occurredAt: start.toISOString(),
        timeZone: TIME_ZONE,
        title: a.title,
        body: null,
        details: null,
        allDay: a.allDay ?? false,
        endsAt: a.minutes ? new Date(start.getTime() + a.minutes * 60_000).toISOString() : null,
        place: a.place ?? null,
      },
      text: a.text ?? "",
      providerIds: (a.with ?? []).map(providerIdOf),
    };
  });

  const through = addDays(dayInZone(new Date(now), TIME_ZONE), SERIES_AHEAD_DAYS);
  const series = TEDDER_SERIES.map((s, i) => {
    const row = {
      id: seriesId(i),
      groupId: TEDDER_GROUP_ID,
      recipientId: TEDDER_RECIPIENT_ID,
      ...s.content,
      startsOn: addDays(dayInZone(new Date(now), TIME_ZONE), s.startsIn),
      timeZone: TIME_ZONE,
      providerIds: [],
      toppedUpThrough: through,
    };
    const visits = seriesVisits(
      { ...row, startTime: row.startTime ?? null, allDay: !!row.allDay },
      row.startsOn,
      through,
    ).map((visit) => ({
      id: seriesVisitId(row.id, visit.day),
      content: {
        kind: row.kind,
        occurredAt: visit.start,
        timeZone: TIME_ZONE,
        title: row.title ?? null,
        body: null,
        details: null,
        allDay: !!row.allDay,
        endsAt: visit.end,
        place: row.place ?? null,
        seriesId: row.id,
        seriesDay: visit.day,
        seriesDetached: false,
      },
    }));
    return { row, visits };
  });

  const todos = TEDDER_TODOS.map((t, i) => ({
    id: todoId(i),
    groupId: TEDDER_GROUP_ID,
    recipientId: TEDDER_RECIPIENT_ID,
    title: t.title,
    assignee: t.assignee ?? null,
    assigneeName: null,
    dueOn: t.dueIn === undefined ? null : addDays(today, t.dueIn),
    dueTime: t.dueTime ?? null,
    doneAt: t.doneDaysAgo === undefined ? null : new Date(now - t.doneDaysAgo * DAY).toISOString(),
    doneBy: t.doneBy ?? null,
    providerId: t.provider ? providerIdOf(t.provider) : null,
    medicationId: t.medication ? medicationIdOf(t.medication) : null,
    eventId: null,
    repeatRule: null,
    repeatStartsOn: null,
    repeatId: null,
    author: t.author,
  }));

  return {
    entries,
    providers,
    providerNotes,
    passes,
    medications,
    doses: loggedDoses,
    appointments,
    series,
    todos,
  };
};

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------

export const seed = async () => {
  const db = getDb();
  await db
    .insert(userSchema)
    .values(TEDDER_USERS.map((u) => ({ ...u, role: "member" as const, emailVerified: true, ...seedAudits })))
    .onConflictDoNothing({ target: userSchema.email });
  const users = await db
    .select({ id: userSchema.id, email: userSchema.email })
    .from(userSchema)
    .where(
      inArray(
        userSchema.email,
        TEDDER_USERS.map((u) => u.email),
      ),
    );
  const idByEmail = new Map(users.map((u) => [u.email, u.id]));
  const userId = (email: Email) => {
    const id = idByEmail.get(email);
    if (!id) throw new Error(`Seed user missing: ${email}`);
    return id;
  };
  const by = (email: Email) => ({ createdBy: userId(email), updatedBy: userId(email) });

  const password = process.env.SEED_USER_PASSWORD;
  if (password) {
    const hash = await seedPasswordHash(password);
    await db
      .insert(accountSchema)
      .values(users.map((u) => ({ userId: u.id, providerId: "credential", accountId: u.id, password: hash })))
      .onConflictDoNothing({ target: [accountSchema.providerId, accountSchema.accountId] });
  }

  const now = Date.now();
  const rows = seedRows(now);
  const owner = by(OWNER);
  // Notes and documents last edited a couple of days ago, so nobody shows as typing.
  const editedAt = new Date(now - 2 * DAY).toISOString();
  const document = async (
    id: string,
    subject: "entry" | "provider",
    text: string,
    author: Email,
    at: string,
  ) => {
    const doc = noteDocFromText(text);
    await db
      .insert(noteDocumentSchema)
      .values({
        id,
        groupId: TEDDER_GROUP_ID,
        subject,
        ...(subject === "entry" ? { entryId: id } : { providerId: id }),
        snapshot: encodeNoteDoc(doc),
        text: noteText(doc),
        editors: { [userId(author)]: at },
        createdAt: at,
        updatedAt: at,
        ...by(author),
      })
      .onConflictDoNothing({ target: noteDocumentSchema.id });
    doc.destroy();
  };

  // Group, recipient, members, profile.
  await db
    .insert(careGroupSchema)
    .values({ id: TEDDER_GROUP_ID, name: "Tedder Family", ...owner })
    .onConflictDoNothing({ target: careGroupSchema.id });
  await db
    .insert(careRecipientSchema)
    .values({ id: TEDDER_RECIPIENT_ID, groupId: TEDDER_GROUP_ID, ...TEDDER_RECIPIENT, ...seedAudits })
    .onConflictDoNothing({ target: careRecipientSchema.id });
  await db
    .insert(careRecipientDetailsSchema)
    .values({
      id: DETAILS_ID,
      groupId: TEDDER_GROUP_ID,
      recipientId: TEDDER_RECIPIENT_ID,
      ...TEDDER_DETAILS,
      ...seedAudits,
    })
    .onConflictDoNothing({ target: careRecipientDetailsSchema.id });

  const memberships = await db
    .insert(careGroupMemberSchema)
    .values(
      TEDDER_MEMBERS.map((m) => ({
        groupId: TEDDER_GROUP_ID,
        userId: userId(m.email),
        role: m.role,
        relationship: m.relationship,
        sharedFields: m.sharedFields,
        emergencyRank: m.emergencyRank,
        isPrimaryContact: m.isPrimaryContact,
        ...seedAudits,
      })),
    )
    .onConflictDoNothing({ target: [careGroupMemberSchema.groupId, careGroupMemberSchema.userId] })
    .returning({ id: careGroupMemberSchema.id, userId: careGroupMemberSchema.userId });
  for (const member of TEDDER_MEMBERS) {
    const uid = userId(member.email);
    await db
      .insert(userContactSchema)
      .values({ id: member.contactId, userId: uid, ...member.contact, ...seedAudits })
      .onConflictDoNothing();
    // Only for a membership made just now; the projection, as memberSharingService writes it.
    const membership = memberships.find((m) => m.userId === uid);
    const share = sharedContact(member.contact, member.sharedFields);
    if (membership && sharesAnything(share)) {
      await db
        .insert(memberContactShareSchema)
        .values({ id: membership.id, groupId: TEDDER_GROUP_ID, userId: uid, ...share, ...seedAudits })
        .onConflictDoNothing();
    }
  }
  await db
    .insert(recipientAllergySchema)
    .values(
      TEDDER_ALLERGIES.map((a) => ({
        ...a,
        groupId: TEDDER_GROUP_ID,
        recipientId: TEDDER_RECIPIENT_ID,
        ...owner,
      })),
    )
    .onConflictDoNothing({ target: recipientAllergySchema.id });
  await db
    .insert(recipientConditionSchema)
    .values(
      TEDDER_CONDITIONS.map((c) => ({
        sinceMonth: null,
        note: null,
        ...c,
        groupId: TEDDER_GROUP_ID,
        recipientId: TEDDER_RECIPIENT_ID,
        ...owner,
      })),
    )
    .onConflictDoNothing({ target: recipientConditionSchema.id });

  // Timeline.
  for (const { row, author, documentText } of rows.entries) {
    await db
      .insert(timelineEntrySchema)
      .values({ ...row, createdAt: row.occurredAt, updatedAt: row.occurredAt, ...by(author) })
      .onConflictDoNothing({ target: timelineEntrySchema.id });
    if (documentText !== null) await document(row.id, "entry", documentText, author, row.occurredAt);
  }

  // Providers (practices first: clinicians point at them) and their notes.
  const ordered = [...rows.providers].sort((a, b) => Number(!!a.practiceId) - Number(!!b.practiceId));
  for (const provider of ordered) {
    await db
      .insert(providerSchema)
      .values({ ...provider, ...owner })
      .onConflictDoNothing({ target: providerSchema.id });
  }
  for (const note of rows.providerNotes) await document(note.id, "provider", note.text, OWNER, editedAt);

  // Passes, medications, their "started" entries, and the last few days' doses.
  await db
    .insert(medicationPassSchema)
    .values(rows.passes.map((p) => ({ ...p, ...owner })))
    .onConflictDoNothing({ target: medicationPassSchema.id });
  for (const { row, changeEntry, addedAt, author } of rows.medications) {
    const added = { createdAt: addedAt, updatedAt: addedAt, ...by(author) };
    await db
      .insert(medicationSchema)
      .values({ ...row, ...added })
      .onConflictDoNothing({ target: medicationSchema.id });
    if (changeEntry) {
      await db
        .insert(timelineEntrySchema)
        .values({ ...changeEntry, ...added })
        .onConflictDoNothing({ target: timelineEntrySchema.id });
    }
  }
  for (const { row, author } of rows.doses) {
    await db
      .insert(timelineEntrySchema)
      .values({ ...row, createdAt: row.occurredAt, updatedAt: row.occurredAt, ...by(author) })
      .onConflictDoNothing({ target: timelineEntrySchema.id });
  }

  // Upcoming events, their documents and providers.
  for (const { id, author, content, text, providerIds } of rows.appointments) {
    await db
      .insert(timelineEntrySchema)
      .values({
        id,
        groupId: TEDDER_GROUP_ID,
        recipientId: TEDDER_RECIPIENT_ID,
        ...content,
        createdAt: editedAt,
        updatedAt: editedAt,
        ...by(author),
      })
      .onConflictDoNothing({ target: timelineEntrySchema.id });
    await document(id, "entry", text, author, editedAt);
    for (const pid of providerIds) {
      await db
        .insert(timelineEntryProviderSchema)
        .values({
          id: entryProviderId(id, pid),
          groupId: TEDDER_GROUP_ID,
          entryId: id,
          providerId: pid,
          ...by(author),
        })
        .onConflictDoNothing({ target: timelineEntryProviderSchema.id });
    }
  }

  // The repeating series and its visits.
  for (const { row, visits } of rows.series) {
    await db
      .insert(appointmentSeriesSchema)
      .values({ ...row, ...owner })
      .onConflictDoNothing({ target: appointmentSeriesSchema.id });
    for (const visit of visits) {
      await db
        .insert(timelineEntrySchema)
        .values({
          id: visit.id,
          groupId: TEDDER_GROUP_ID,
          recipientId: TEDDER_RECIPIENT_ID,
          ...visit.content,
          ...owner,
        })
        .onConflictDoNothing();
      await document(visit.id, "entry", "", OWNER, editedAt);
    }
  }

  // Todos.
  await db
    .insert(todoSchema)
    .values(
      rows.todos.map(({ assignee, author, doneBy, ...todo }) => ({
        ...todo,
        assigneeId: assignee ? userId(assignee) : null,
        doneBy: doneBy ? userId(doneBy) : null,
        ...by(author),
      })),
    )
    .onConflictDoNothing({ target: todoSchema.id });
};
