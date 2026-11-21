import { inArray } from "drizzle-orm";
import { getDb } from "../client";
import { addDays, localDate, todoSchema, userSchema } from "../schema";
import { appointmentIdIn } from "./appointments";
import { DEV_GROUP_ID, DEV_RECIPIENT_ID } from "./careGroups";
import { SEED_GROUPS as MEDICATION_GROUPS } from "./medications";
import { SEED_GROUPS as PROVIDER_GROUPS } from "./providers";
import { SECOND_GROUP_ID, SECOND_RECIPIENT_ID } from "./secondGroup";

// Fictional todos: about eight for Dev Family (assigned to member@,
// caretaker@ and viewer@, one to a typed-in "Aunt May", some unassigned;
// overdue, today, later and undated; two done) and one for Dev Family 2.
// Placed by days from today in the recipients' zone (both Los Angeles).
// The last three link to a seeded provider, appointment and medication
// (todos slice 3), by their seeds' keys.
//
// Their own ids (…3f1d2be0… Dev Family's, …3f1d2be1… Dev Family 2's),
// following list order: append only.

const TIME_ZONE = "America/Los_Angeles";
const DAY = 24 * 60 * 60 * 1000;

type Person = "member@example.com" | "caretaker@example.com" | "viewer@example.com";

export type SeedTodo = {
  title: string;
  /** Days from today (negative: past), in America/Los_Angeles; omit for no due date. */
  dueIn?: number;
  /** "HH:MM" on the due day. */
  dueTime?: string;
  assignee?: Person;
  /** A typed-in assignee outside the group. */
  assigneeName?: string;
  author: "member@example.com" | "caretaker@example.com";
  /** Done this many days ago, by `doneBy`. */
  doneDaysAgo?: number;
  doneBy?: Person;
  /** Keys of the group's seeded provider (`seeds/providers.ts`), appointment (`seeds/appointments.ts`) and medication (`seeds/medications.ts`). */
  provider?: string;
  event?: string;
  medication?: string;
};

export const DEV_FAMILY_TODOS: SeedTodo[] = [
  {
    title: "Call the pharmacy about the refill",
    dueIn: -2,
    assignee: "caretaker@example.com",
    author: "member@example.com",
  },
  { title: "Fax the insurance form", dueIn: -1, author: "member@example.com" },
  {
    title: "Pick up the walker",
    dueIn: 0,
    dueTime: "17:00",
    assignee: "member@example.com",
    author: "caretaker@example.com",
  },
  { title: "Pick up groceries", dueIn: 0, assignee: "viewer@example.com", author: "member@example.com" },
  {
    title: "Drive Pat to physio",
    dueIn: 3,
    dueTime: "10:30",
    assigneeName: "Aunt May",
    author: "member@example.com",
  },
  {
    title: "Ask about the new tremor",
    dueIn: 6,
    assignee: "member@example.com",
    author: "caretaker@example.com",
  },
  { title: "Sort out the hearing aid batteries", author: "caretaker@example.com" },
  {
    title: "Book the eye appointment",
    dueIn: -4,
    assignee: "caretaker@example.com",
    author: "member@example.com",
    doneDaysAgo: 3,
    doneBy: "caretaker@example.com",
  },
  {
    title: "Water the plants",
    assignee: "viewer@example.com",
    author: "member@example.com",
    doneDaysAgo: 1,
    doneBy: "viewer@example.com",
  },
  // Linked todos (todos slice 3).
  {
    title: "Ask Dr. Patel's office about the stress test",
    dueIn: 1,
    dueTime: "12:00",
    assignee: "member@example.com",
    author: "caretaker@example.com",
    provider: "patel",
  },
  {
    title: "Bring the blood pressure log",
    dueIn: 2,
    assignee: "caretaker@example.com",
    author: "member@example.com",
    event: "patel",
  },
  {
    title: "Refill Latanoprost",
    dueIn: 2,
    assignee: "viewer@example.com",
    author: "caretaker@example.com",
    medication: "latanoprost",
  },
];

export const SECOND_GROUP_TODOS: SeedTodo[] = [
  { title: "Renew Lou's bus pass", dueIn: 2, assignee: "member@example.com", author: "member@example.com" },
];

const devTodoId = (index: number) =>
  `0b6f3c1e-5d1a-4c2e-9a77-3f1d2be0${String(1001 + index).padStart(4, "0")}`;
const secondTodoId = (index: number) =>
  `0b6f3c1e-5d1a-4c2e-9a77-3f1d2be1${String(1001 + index).padStart(4, "0")}`;

const GROUPS = [
  { groupId: DEV_GROUP_ID, recipientId: DEV_RECIPIENT_ID, todos: DEV_FAMILY_TODOS, id: devTodoId },
  { groupId: SECOND_GROUP_ID, recipientId: SECOND_RECIPIENT_ID, todos: SECOND_GROUP_TODOS, id: secondTodoId },
];

const providerIdIn = (groupId: string, key: string) => {
  const group = PROVIDER_GROUPS.find((g) => g.groupId === groupId);
  const index = group?.providers.findIndex((p) => p.key === key) ?? -1;
  if (!group || index < 0) throw new Error(`Seed todo links a missing provider: ${key}`);
  return group.providerId(index);
};

const medicationIdIn = (groupId: string, key: string) => {
  const group = MEDICATION_GROUPS.find((g) => g.groupId === groupId);
  const index = group?.medications.findIndex((m) => m.key === key) ?? -1;
  if (!group || index < 0) throw new Error(`Seed todo links a missing medication: ${key}`);
  return group.medicationId(index);
};

/** Every seeded todo as a row, with people as emails (resolved when seeding). */
export const seedRows = (now = Date.now()) => {
  const today = localDate(now, TIME_ZONE);
  return GROUPS.flatMap(({ groupId, recipientId, todos, id }) =>
    todos.map((todo, index) => ({
      id: id(index),
      groupId,
      recipientId,
      title: todo.title,
      assignee: todo.assignee ?? null,
      assigneeName: todo.assigneeName ?? null,
      dueOn: todo.dueIn === undefined ? null : addDays(today, todo.dueIn),
      dueTime: todo.dueTime ?? null,
      doneAt: todo.doneDaysAgo === undefined ? null : new Date(now - todo.doneDaysAgo * DAY).toISOString(),
      doneBy: todo.doneBy ?? null,
      providerId: todo.provider ? providerIdIn(groupId, todo.provider) : null,
      medicationId: todo.medication ? medicationIdIn(groupId, todo.medication) : null,
      eventId: todo.event ? appointmentIdIn(groupId, todo.event) : null,
      author: todo.author,
    })),
  );
};

export const seed = async () => {
  const db = getDb();
  const emails = ["member@example.com", "caretaker@example.com", "viewer@example.com"];
  const users = await db
    .select({ id: userSchema.id, email: userSchema.email })
    .from(userSchema)
    .where(inArray(userSchema.email, emails));
  const idOf = (email: string | null) => (email ? (users.find((u) => u.email === email)?.id ?? null) : null);
  if (users.length < emails.length) return;

  await db
    .insert(todoSchema)
    .values(
      seedRows().map(({ assignee, author, doneBy, ...row }) => ({
        ...row,
        assigneeId: idOf(assignee),
        doneBy: idOf(doneBy),
        createdBy: idOf(author)!,
        updatedBy: idOf(author)!,
      })),
    )
    .onConflictDoNothing({ target: todoSchema.id });
};
