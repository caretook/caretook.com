import { inArray } from "drizzle-orm";
import { getDb } from "../client";
import { addDays, localDate, taskSchema, userSchema } from "../schema";
import { DEV_GROUP_ID, DEV_RECIPIENT_ID } from "./careGroups";
import { SECOND_GROUP_ID, SECOND_RECIPIENT_ID } from "./secondGroup";

// Fictional tasks: about eight for Dev Family (assigned to member@,
// caretaker@ and viewer@, one to a typed-in "Aunt May", some unassigned;
// overdue, today, later and undated; two done) and one for Dev Family 2.
// Placed by days from today in the recipients' zone (both Los Angeles).
// Links stay empty until linked seeds are appended (tasks slice 3).
//
// Their own ids (…3f1d2be0… Dev Family's, …3f1d2be1… Dev Family 2's),
// following list order: append only.

const TIME_ZONE = "America/Los_Angeles";
const DAY = 24 * 60 * 60 * 1000;

type Person = "member@example.com" | "caretaker@example.com" | "viewer@example.com";

export type SeedTask = {
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
};

export const DEV_FAMILY_TASKS: SeedTask[] = [
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
];

export const SECOND_GROUP_TASKS: SeedTask[] = [
  { title: "Renew Lou's bus pass", dueIn: 2, assignee: "member@example.com", author: "member@example.com" },
];

const devTaskId = (index: number) =>
  `0b6f3c1e-5d1a-4c2e-9a77-3f1d2be0${String(1001 + index).padStart(4, "0")}`;
const secondTaskId = (index: number) =>
  `0b6f3c1e-5d1a-4c2e-9a77-3f1d2be1${String(1001 + index).padStart(4, "0")}`;

const GROUPS = [
  { groupId: DEV_GROUP_ID, recipientId: DEV_RECIPIENT_ID, tasks: DEV_FAMILY_TASKS, id: devTaskId },
  { groupId: SECOND_GROUP_ID, recipientId: SECOND_RECIPIENT_ID, tasks: SECOND_GROUP_TASKS, id: secondTaskId },
];

/** Every seeded task as a row, with people as emails (resolved when seeding). */
export const seedRows = (now = Date.now()) => {
  const today = localDate(now, TIME_ZONE);
  return GROUPS.flatMap(({ groupId, recipientId, tasks, id }) =>
    tasks.map((task, index) => ({
      id: id(index),
      groupId,
      recipientId,
      title: task.title,
      assignee: task.assignee ?? null,
      assigneeName: task.assigneeName ?? null,
      dueOn: task.dueIn === undefined ? null : addDays(today, task.dueIn),
      dueTime: task.dueTime ?? null,
      doneAt: task.doneDaysAgo === undefined ? null : new Date(now - task.doneDaysAgo * DAY).toISOString(),
      doneBy: task.doneBy ?? null,
      author: task.author,
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
    .insert(taskSchema)
    .values(
      seedRows().map(({ assignee, author, doneBy, ...row }) => ({
        ...row,
        assigneeId: idOf(assignee),
        doneBy: idOf(doneBy),
        createdBy: idOf(author)!,
        updatedBy: idOf(author)!,
      })),
    )
    .onConflictDoNothing({ target: taskSchema.id });
};
