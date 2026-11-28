import type { GoogleCalendarConnection } from "../src/db/schema";
import type { GoogleCalendarSession, GoogleEvent, GoogleEventInput } from "../src/google";
import type { ServiceContext } from "../src/services";

import { randomBytes } from "node:crypto";
import { createInterface } from "node:readline/promises";
import { and, eq, isNull } from "drizzle-orm";
import { isWriterRole } from "../src/constants";
import { endClient, getDb } from "../src/db/client";
import {
  careGroupMemberSchema,
  careRecipientSchema,
  googleCalendarConnectionSchema,
  googleEventLinkSchema,
  timelineEntrySchema,
  userSchema,
} from "../src/db/schema";
import { isError } from "../src/errors";
import {
  eventUid,
  getGoogleCalendarClient,
  googleEventId,
  googleRedirectUri,
  setCalendarBackgroundRunner,
} from "../src/google";
import {
  calendarPullService,
  calendarSyncService,
  googleConnectionService,
  timelineEntryService,
} from "../src/services";
import { loadEnv } from "../src/utils/loadEnv";
import { openGoogleToken } from "../src/utils/googleToken";

// pnpm calendar:google-smoke (appointments-2, slice 9): a manual check of
// Google Calendar against a real Google account, never part of `pnpm check`.
// It connects a member (or reuses their connection), adds two made-up
// appointments and pushes the group, then plays the member in Google
// through the API (moves one, deletes the other, makes a new event), pulls,
// and checks Caretook took each change. It cleans up after itself. See the
// runbook (step 5a) for the setup.

const USAGE = `Usage: pnpm calendar:google-smoke --email <member's email> [--group <care group id>] [--keep] [--disconnect]

A manual check of Google Calendar against a real Google account (never in pnpm check).

  --email       the Caretook account to connect (a writer in the group; dev: caretaker@example.com)
  --group       the care group, when the member has more than one
  --keep        leave the smoke appointments in Caretook and Google afterwards
  --disconnect  disconnect Google at the end (the calendar stays in Google)

Needs GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_TOKEN_KEY (outside dev), APP_URL
(the OAuth client's redirect URI is <APP_URL>/api/google/callback) and DATABASE_URL,
from the environment or packages/data/.env. Every name it writes is made up.`;

type Args = { email: string; group: string | null; keep: boolean; disconnect: boolean };

const parseArgs = (argv: string[]): Args | { help: true } | { error: string } => {
  const args: Args = { email: "", group: null, keep: false, disconnect: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--") continue;
    if (arg === "--help" || arg === "-h") return { help: true };
    if (arg === "--keep") args.keep = true;
    else if (arg === "--disconnect") args.disconnect = true;
    else if (arg === "--email" || arg === "--group") {
      const value = argv[++i];
      if (!value || value.startsWith("--")) return { error: `${arg} needs a value` };
      if (arg === "--email") args.email = value.trim().toLowerCase();
      else args.group = value.trim();
    } else return { error: `Unknown argument: ${arg}` };
  }
  return args.email ? args : { error: "--email is required" };
};

const parsed = parseArgs(process.argv.slice(2));
if ("help" in parsed) {
  console.log(USAGE);
  process.exit(0);
}
if ("error" in parsed) {
  console.error(`${parsed.error}\n\n${USAGE}`);
  process.exit(1);
}

loadEnv();
const missing = ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "DATABASE_URL"].filter(
  (name) => !process.env[name]?.trim(),
);
if (missing.length) {
  console.error(`Missing ${missing.join(", ")}.\n\n${USAGE}`);
  process.exit(1);
}

// Pushes the services start after a commit: kept here, and awaited before each check.
let background: Promise<unknown>[] = [];
setCalendarBackgroundRunner((work) => background.push(work));
const settled = async () => {
  while (background.length) {
    const batch = background;
    background = [];
    await Promise.all(batch);
  }
};

const results: { name: string; ok: boolean; detail?: string }[] = [];
const check = (name: string, ok: boolean, detail?: string) => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` (${detail})` : ""}`);
};
const fail = async (message: string): Promise<never> => {
  console.error(`❌ ${message}`);
  await endClient();
  process.exit(1);
};
const must = async <T>(value: T, what: string): Promise<Exclude<T, { code: unknown }>> => {
  if (isError(value)) return fail(`${what}: [${String(value.code)}] ${value.message}`);
  return value as Exclude<T, { code: unknown }>;
};

const client = getGoogleCalendarClient();
if (!client) await fail("Google isn't set up here (GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET)");
const google = client!;
const db = getDb();

// The member and their group.
const [user] = await db
  .select({ id: userSchema.id, email: userSchema.email })
  .from(userSchema)
  .where(eq(userSchema.email, parsed.email));
if (!user) await fail(`No account for ${parsed.email}`);
const memberships = await db
  .select({ groupId: careGroupMemberSchema.groupId, role: careGroupMemberSchema.role })
  .from(careGroupMemberSchema)
  .where(eq(careGroupMemberSchema.userId, user!.id));
const membership = parsed.group
  ? memberships.find((m) => m.groupId === parsed.group)
  : memberships.length === 1
    ? memberships[0]
    : undefined;
if (!membership)
  await fail(
    parsed.group
      ? `${parsed.email} isn't a member of ${parsed.group}`
      : `${parsed.email} is in ${memberships.length} groups: pass --group (one of ${memberships.map((m) => m.groupId).join(", ")})`,
  );
const { groupId, role } = membership!;
if (!isWriterRole(role))
  await fail("Use a writer (owner, admin or caretaker): a viewer's changes are put back");
const ctx: ServiceContext = {
  authUser: { id: user!.id, roleNames: ["member"], groupRoles: { [groupId]: role } },
};
const [recipient] = await db
  .select({ timeZone: careRecipientSchema.timeZone })
  .from(careRecipientSchema)
  .where(eq(careRecipientSchema.groupId, groupId));
const timeZone = recipient?.timeZone ?? "UTC";
console.log(`Member ${user!.email} (${role}) in group ${groupId}, ${timeZone}`);

const liveConnection = async () => {
  const [row] = await db
    .select()
    .from(googleCalendarConnectionSchema)
    .where(
      and(
        eq(googleCalendarConnectionSchema.userId, user!.id),
        eq(googleCalendarConnectionSchema.groupId, groupId),
        isNull(googleCalendarConnectionSchema.disconnectedAt),
      ),
    );
  return row ?? null;
};

// 1. Connect (or reuse a working connection).
let conn: GoogleCalendarConnection | null = await liveConnection();
if (!conn || conn.lastError) {
  const started = await must(await googleConnectionService.start(ctx, groupId), "Connect");
  console.log(
    `\nOpen this in a browser signed in to the Google test account, and allow access:\n\n${started.url}\n`,
  );
  console.log(`Google then sends you to ${googleRedirectUri()}?code=…&state=….`);
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = (
    await rl.question("Paste that address here, or press Enter if the app there finished connecting: ")
  ).trim();
  rl.close();
  if (answer) {
    const query = new URL(answer, "http://pasted.invalid").searchParams;
    const code = query.get("code");
    const state = query.get("state");
    if (!code || !state) await fail("That address has no code and state");
    await must(await googleConnectionService.complete(ctx, { code: code!, state: state! }), "Connect");
  }
  await settled();
  conn = await liveConnection();
  if (!conn || conn.lastError) await fail("Not connected: try again");
}
check("connected", true, conn!.calendarName);

const token = openGoogleToken(conn!.refreshTokenSealed ?? "", conn!.id);
if (!token) await fail("The sealed token doesn't open: is GOOGLE_TOKEN_KEY the one it was connected with?");
const session: GoogleCalendarSession = await must(await google.refresh(token!), "Google refresh");
const calendarId = conn!.calendarId;

// 2. Two made-up appointments tomorrow, then push the group.
const runId = randomBytes(3).toString("hex");
const tomorrow = (hour: number) => {
  const at = new Date(Date.now() + 86_400_000);
  at.setUTCHours(hour, 0, 0, 0);
  return at.toISOString();
};
const addAppointment = async (title: string, hour: number) =>
  (await must(
    await timelineEntryService.create(ctx, {
      groupId,
      kind: "event",
      title: `${title} (smoke ${runId})`,
      occurredAt: tomorrow(hour),
      endsAt: tomorrow(hour + 1),
      timeZone,
      details: null,
    }),
    `Add "${title}"`,
  ))!;
const toMove = await addAppointment("Smoke check: move me", 17);
const toDelete = await addAppointment("Smoke check: delete me", 19);
await settled();
const fresh = async () => (await liveConnection())!;
const pushed = await must(
  await calendarSyncService.pushConnection(await fresh(), { client: google }),
  "Push",
);
check("pushed the group", "status" in pushed && pushed.status === "pushed", JSON.stringify(pushed));

const listAll = async () => {
  const listed = await must(await session.listChanges(calendarId, null), "List the calendar");
  return "events" in listed ? listed.events : [];
};
const inGoogle = await listAll();
const byUid = (uid: string) => inGoogle.find((e) => eventUid(e) === uid && e.status !== "cancelled");
const movedEvent = byUid(`entry:${toMove.id}`);
const deletedEvent = byUid(`entry:${toDelete.id}`);
check("both appointments are in Google, tagged", !!movedEvent && !!deletedEvent);
if (!movedEvent || !deletedEvent) await fail("The push didn't reach Google");

// A first pull takes Google's sync token (our own events come back as echoes, so it applies nothing).
const first = await must(await calendarPullService.pullConnection(await fresh(), { client: google }), "Pull");
check("first pull took the sync token", first.status === "pulled", JSON.stringify(first));

// 3. The member, in Google: move one, delete the other, make a new event.
const shift = (time: GoogleEvent["start"], hours: number) =>
  time && "dateTime" in time
    ? { dateTime: new Date(new Date(time.dateTime).getTime() + hours * 3_600_000).toISOString(), timeZone }
    : time!;
const asInput = (event: GoogleEvent, over: Partial<GoogleEventInput>): GoogleEventInput => ({
  id: event.id,
  summary: event.summary ?? "",
  description: event.description ?? "",
  location: event.location,
  start: event.start!,
  end: event.end!,
  transparency: "opaque",
  privateProperties: event.privateProperties,
  ...over,
});
await must(
  await session.upsertEvent(
    calendarId,
    asInput(movedEvent!, { start: shift(movedEvent!.start, 1), end: shift(movedEvent!.end, 1) }),
  ),
  "Move in Google",
);
await must(await session.deleteEvent(calendarId, deletedEvent!.id), "Delete in Google");
const madeId = googleEventId(`smoke:${runId}`).replace(/^ct/, "sm");
const madeTitle = `Smoke check: made in Google (smoke ${runId})`;
await must(
  await session.upsertEvent(calendarId, {
    id: madeId,
    summary: madeTitle,
    description: "",
    location: null,
    start: { dateTime: tomorrow(21), timeZone },
    end: { dateTime: tomorrow(22), timeZone },
    transparency: "opaque",
    privateProperties: {},
  }),
  "Create in Google",
);

// 4. Pull, and check Caretook.
const pulled = await must(
  await calendarPullService.pullConnection(await fresh(), { client: google }),
  "Pull",
);
await settled();
await must(await calendarSyncService.runDue({ client: google }), "Push after the pull");
check(
  "pull applied the three changes",
  pulled.status === "pulled" && pulled.applied === 3,
  JSON.stringify(pulled),
);

const entry = async (id: string) =>
  (await db.select().from(timelineEntrySchema).where(eq(timelineEntrySchema.id, id)))[0];
const moved = await entry(toMove.id);
check(
  "the move reached Caretook",
  !!moved && new Date(moved.occurredAt).getTime() === new Date(toMove.occurredAt).getTime() + 3_600_000,
  moved ? `now ${new Date(moved.occurredAt).toISOString()}` : "missing",
);
const cancelled = await entry(toDelete.id);
check("the delete cancelled the appointment", !!cancelled?.cancelledAt);
const [madeLink] = await db
  .select()
  .from(googleEventLinkSchema)
  .where(
    and(eq(googleEventLinkSchema.connectionId, conn!.id), eq(googleEventLinkSchema.googleEventId, madeId)),
  );
const made = madeLink ? await entry(madeLink.itemUid.replace(/^entry:/, "")) : undefined;
check("the new event became an appointment", made?.title === madeTitle, made ? made.id : "missing");
const tagged = (await listAll()).find((e) => e.id === madeId);
check("the new event is tagged as ours", !!tagged && eventUid(tagged) === `entry:${made?.id}`);

// 5. Clean up.
if (!parsed.keep) {
  for (const id of [toMove.id, toDelete.id, made?.id].filter((v): v is string => !!v))
    await must(await timelineEntryService.remove(ctx, id), "Clean up");
  await settled();
  await must(
    await calendarSyncService.pushConnection(await fresh(), { client: google }),
    "Push the clean-up",
  );
  console.log("Removed the smoke appointments (from Google too).");
}
if (parsed.disconnect) {
  await must(await googleConnectionService.disconnect(ctx, groupId), "Disconnect");
  console.log("Disconnected (the calendar stays in Google).");
}

await settled();
await endClient();
const failed = results.filter((r) => !r.ok);
if (failed.length) {
  console.error(`❌ Google smoke: ${failed.length} of ${results.length} checks failed`);
  process.exit(1);
}
console.log(`✅ Google smoke: ${results.length} checks passed`);
