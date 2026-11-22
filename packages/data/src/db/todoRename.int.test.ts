import { readFileSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createGroup, createUser, ok } from "../../test/fixtures";
import { timelineEntryService, todoService } from "../services";
import { MIGRATIONS_FOLDER } from "./migrate";

// Migration 0032_todos (tasks-2): tasks become todos in one step. The test
// database is already migrated, so inside one transaction (rolled back) this
// puts it back the way 0031 left it, writes rows in that shape, runs 0032's
// statements, and checks what they left. DDL is transactional in Postgres,
// and integration files run one at a time, so nothing else sees the detour.

const statements = readFileSync(join(MIGRATIONS_FOLDER, "0032_todos.sql"), "utf8")
  .split("--> statement-breakpoint")
  .map((s) => s.replace(/^--.*$/gm, "").trim())
  .filter(Boolean);

const TABLE_RENAME = 'ALTER TABLE "task" RENAME TO "todo";';
// A column, constraint or index rename: ALTER TABLE "t" RENAME COLUMN "a" TO "b", ALTER INDEX "a" RENAME TO "b".
const RENAME =
  /^(ALTER TABLE "[^"]+" RENAME (?:COLUMN|CONSTRAINT) |ALTER INDEX )"([^"]+)" (RENAME )?TO "([^"]+)";$/;
const CHECK_DROP = /DROP CONSTRAINT/;
const CHECK_ADD = /ADD CONSTRAINT .* CHECK/s;

/** Postgres 18's NOT NULL constraint names, back to 0031's (the migration's DO block renames them). */
const NOT_NULL_BACK = `DO $$
DECLARE c record;
BEGIN
  FOR c IN SELECT conname FROM pg_constraint WHERE conrelid = '"todo"'::regclass AND contype = 'n' LOOP
    EXECUTE format('ALTER TABLE "todo" RENAME CONSTRAINT %I TO %I', c.conname, 'task' || substr(c.conname, 5));
  END LOOP;
END $$;`;

/**
 * 0032 backwards: its checks dropped, its other renames undone (last first,
 * while the table is still "todo"), the table renamed back, the stored values
 * back, and 0031's checks.
 */
const undo = [
  ...statements.filter((s) => CHECK_DROP.test(s)),
  ...statements
    .filter((s) => RENAME.test(s))
    .reverse()
    .map((s) => {
      const [, head, from, index, to] = RENAME.exec(s)!;
      return `${head}"${to}" ${index ?? ""}TO "${from}";`;
    }),
  NOT_NULL_BACK,
  'ALTER TABLE "todo" RENAME TO "task";',
  // Other test files' rows are in the new shape: back to the old one, so the old checks hold.
  `UPDATE "note_document" SET "subject" = 'task' WHERE "subject" = 'todo'`,
  `UPDATE "calendar_sync_job" SET "reason" = 'task' WHERE "reason" = 'todo'`,
  ...statements
    .filter((s) => CHECK_ADD.test(s))
    .map((s) => s.replaceAll("'todo'", "'task'").replaceAll('"todo_id"', '"task_id"')),
];

const AT = "2026-11-19T17:00:00.000Z";

let client: pg.Client;

beforeAll(async () => {
  client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
});

afterAll(async () => {
  await client.end();
});

const one = async <T>(query: string, params: unknown[] = []) =>
  (await client.query(query, params)).rows[0] as T;

describe("migration 0032_todos", () => {
  it("renames the table, column and constraints, rewrites the stored names, and keeps the event link's SET NULL and the publication", async () => {
    const owner = await createUser("owner");
    const { group } = await createGroup(owner);
    const event = ok(
      await timelineEntryService.create(owner.ctx, {
        groupId: group.id,
        kind: "event",
        title: "Cardiology follow-up",
        occurredAt: new Date(Date.now() + 2 * 86_400_000).toISOString(),
        timeZone: "America/Los_Angeles",
      }),
    )!;
    const todo = ok(
      await todoService.create(owner.ctx, {
        groupId: group.id,
        title: "Bring the BP log",
        eventId: event.id,
      }),
    )!;
    const userId = owner.user.id;
    const reminderKey = (uid: string) => `reminder:${userId}:${group.id}:${uid}:60:${AT}`;
    const entryKey = reminderKey(`entry:${event.id}`);

    // The statements this test reads are the ones it expects.
    expect(statements[0]).toBe(TABLE_RENAME);
    expect(undo.filter((s) => RENAME.test(s))).toHaveLength(statements.filter((s) => RENAME.test(s)).length);

    await client.query("BEGIN");
    try {
      for (const s of undo) await client.query(s);
      // Rows as they stood before 0032.
      expect(await one("SELECT title FROM task WHERE id = $1", [todo.id])).toEqual({
        title: "Bring the BP log",
      });
      await client.query(
        `INSERT INTO note_document (id, group_id, subject, task_id, created_by, updated_by)
         VALUES ($1, $2, 'task', $1, $3, $3)`,
        [todo.id, group.id, userId],
      );
      const { id: connectionId } = await one<{ id: string }>(
        `INSERT INTO google_calendar_connection (user_id, group_id, calendar_id, calendar_name, created_by, updated_by)
         VALUES ($1, $2, 'cal-1', 'Caretook: Pat Example', $1, $1) RETURNING id`,
        [userId, group.id],
      );
      await client.query(
        `INSERT INTO google_event_link (connection_id, item_uid, google_event_id, pushed_hash, created_by, updated_by)
         VALUES ($1, $2, 'ev1', 'h1', $3, $3), ($1, $4, 'ev2', 'h2', $3, $3)`,
        [connectionId, `task:${todo.id}`, userId, `entry:${event.id}`],
      );
      await client.query(
        `INSERT INTO calendar_sync_job (group_id, reason, created_by, updated_by) VALUES ($1, 'task', $2, $2)`,
        [group.id, userId],
      );
      await client.query(
        `INSERT INTO notification_outbox (name, recipient, subject, html, text, idempotency_key, created_by, updated_by)
         VALUES ('taskDue', 'owner@example.com', 'Task for Pat', '', '', $1, $3, $3),
                ('appointmentReminder', 'owner@example.com', 'Appointment for Pat', '', '', $2, $3, $3)`,
        [reminderKey(`task:${todo.id}`), entryKey, userId],
      );

      for (const s of statements) await client.query(s);

      expect(await one("SELECT title, event_id FROM todo WHERE id = $1", [todo.id])).toEqual({
        title: "Bring the BP log",
        event_id: event.id,
      });
      expect(await one("SELECT to_regclass('task') AS old")).toEqual({ old: null });
      expect(await one("SELECT subject, todo_id FROM note_document WHERE id = $1", [todo.id])).toEqual({
        subject: "todo",
        todo_id: todo.id,
      });
      expect(
        (
          await client.query(
            "SELECT item_uid FROM google_event_link WHERE connection_id = $1 ORDER BY google_event_id",
            [connectionId],
          )
        ).rows,
      ).toEqual([{ item_uid: `todo:${todo.id}` }, { item_uid: `entry:${event.id}` }]);
      expect(await one("SELECT reason FROM calendar_sync_job WHERE group_id = $1", [group.id])).toEqual({
        reason: "todo",
      });
      expect(
        (
          await client.query(
            "SELECT name, idempotency_key FROM notification_outbox WHERE idempotency_key = ANY($1) ORDER BY name",
            [[reminderKey(`todo:${todo.id}`), entryKey]],
          )
        ).rows,
      ).toEqual([
        { name: "appointmentReminder", idempotency_key: entryKey },
        { name: "todoDue", idempotency_key: reminderKey(`todo:${todo.id}`) },
      ]);

      // The old subject and reason are refused now.
      await client.query("SAVEPOINT refused");
      await expect(
        client.query(
          `INSERT INTO calendar_sync_job (group_id, reason, created_by, updated_by) VALUES ($1, 'task', $2, $2)`,
          [group.id, userId],
        ),
      ).rejects.toThrow(/calendar_sync_job_reason_check/);
      await client.query("ROLLBACK TO SAVEPOINT refused");

      // Constraints and indexes carry the new name; the event link is still SET NULL ("event_id").
      const constraints = (
        await client.query(
          "SELECT conname FROM pg_constraint WHERE conrelid = 'todo'::regclass ORDER BY conname",
        )
      ).rows.map((r: { conname: string }) => r.conname);
      expect(constraints.every((name) => name.startsWith("todo_"))).toBe(true);
      expect(constraints).toContain("todo_event_fk");
      const { def } = await one<{ def: string }>(
        "SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conname = 'todo_event_fk'",
      );
      expect(def).toContain("ON DELETE SET NULL (event_id)");
      expect(
        (
          await client.query("SELECT indexname FROM pg_indexes WHERE tablename = 'todo' ORDER BY indexname")
        ).rows.map((r: { indexname: string }) => r.indexname),
        // `todo_group_repeat_idx` is 0033_todo_repeats' (planner-2), run after this one.
      ).toEqual([
        "todo_group_assignee_idx",
        "todo_group_due_idx",
        "todo_group_id_id_unique",
        "todo_group_repeat_idx",
        "todo_pkey",
      ]);
      expect(
        await one(
          "SELECT count(*)::int AS n FROM pg_publication_tables WHERE pubname = 'powersync' AND tablename = 'todo'",
        ),
      ).toEqual({ n: 1 });

      // Hard-deleting the linked entry still clears the todo's link.
      await client.query("DELETE FROM timeline_entry WHERE id = $1", [event.id]);
      expect(await one("SELECT event_id, title FROM todo WHERE id = $1", [todo.id])).toEqual({
        event_id: null,
        title: "Bring the BP log",
      });
    } finally {
      await client.query("ROLLBACK");
    }
    expect(await one("SELECT to_regclass('todo') AS now, to_regclass('task') AS old")).toEqual({
      now: "todo",
      old: null,
    });
  });
});
