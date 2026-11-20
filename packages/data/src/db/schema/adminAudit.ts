import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

import { sql } from "drizzle-orm";
import { check, index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { z } from "zod";
import { careGroupSchema } from "./careGroup";
import { id } from "./columns";
import { STAFF_REASON_MAX } from "./staffRules";
import { userSchema } from "./user";

// The staff audit log (admin PRD): every staff write, and every time staff
// open an account's or a group's page. Append-only: written only by
// adminAuditService.record (as the system, inside the action's own
// transaction), read by staff, never updated or deleted by anyone through
// the app (see PERMISSIONS). It never holds care data: `changes` keeps only
// the fields each action names (`auditChanges`).

/**
 * Every action the log records, one list. Later slices' actions are here
 * already, so the log's readers and filters know them all.
 */
export const AUDIT_ACTIONS = [
  "accessCode.create",
  "accessCode.revoke",
  "staffGroup.create",
  "user.view",
  "user.resendVerification",
  "user.sendReset",
  "user.revokeSession",
  "user.revokeAllSessions",
  "user.disable",
  "user.enable",
  "user.setRole",
  "group.view",
  "group.promoteOwner",
  "group.inviteOwner",
  "group.changeRole",
  "group.removeMember",
  "setting.set",
  "db.accessGranted",
  "db.accessRevoked",
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export const isAuditAction = (value: unknown): value is AuditAction => AUDIT_ACTIONS.some((a) => a === value);

/** How each action reads in the log. */
export const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  "accessCode.create": "Created an access code",
  "accessCode.revoke": "Revoked an access code",
  "staffGroup.create": "Set up a group with an owner invite",
  "user.view": "Opened an account",
  "user.resendVerification": "Resent the verification email",
  "user.sendReset": "Sent a password reset",
  "user.revokeSession": "Signed a session out",
  "user.revokeAllSessions": "Signed every session out",
  "user.disable": "Disabled an account",
  "user.enable": "Re-enabled an account",
  "user.setRole": "Changed a staff role",
  "group.view": "Opened a care group",
  "group.promoteOwner": "Made a member an owner",
  "group.inviteOwner": "Invited an owner",
  "group.changeRole": "Changed a member's role",
  "group.removeMember": "Removed a member",
  "setting.set": "Changed a setting",
  "db.accessGranted": "Granted personal database access",
  "db.accessRevoked": "Revoked personal database access",
};

/** A JSON value as `changes` stores it. */
export type AuditValue = string | number | boolean | null | AuditValue[] | { [key: string]: AuditValue };

/** `{ field: [before, after] }`. */
export type AuditChanges = Record<string, [AuditValue, AuditValue]>;

const timestampColumn = (name: string) =>
  timestamp(name, { precision: 3, mode: "string", withTimezone: true });

export const adminAuditLogSchema = pgTable(
  "admin_audit_log",
  {
    id: id(),
    // Null for the system (the `admin:grant` command). No FK: the record
    // keeps who acted even if their account is deleted later.
    actorId: uuid("actor_id"),
    action: text("action", { enum: AUDIT_ACTIONS }).notNull(),
    targetUserId: uuid("target_user_id").references(() => userSchema.id, { onDelete: "set null" }),
    targetGroupId: uuid("target_group_id").references(() => careGroupSchema.id, { onDelete: "set null" }),
    reason: text("reason"),
    changes: jsonb("changes").$type<AuditChanges>().notNull().default({}),
    createdAt: timestampColumn("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("admin_audit_log_created_at_idx").on(t.createdAt),
    index("admin_audit_log_actor_idx").on(t.actorId),
    index("admin_audit_log_target_user_idx").on(t.targetUserId),
    index("admin_audit_log_target_group_idx").on(t.targetGroupId),
    check(
      "admin_audit_log_reason_length",
      sql`char_length(${t.reason}) <= ${sql.raw(String(STAFF_REASON_MAX))}`,
    ),
  ],
);

export type AdminAuditLogSchema = typeof adminAuditLogSchema;
export type AdminAuditLog = InferSelectModel<AdminAuditLogSchema>;
export type AdminAuditLogInsert = InferInsertModel<AdminAuditLogSchema>;

const toAuditValue = (value: unknown): AuditValue => {
  if (value === undefined || value === null) return null;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  if (value instanceof Date) return value.toISOString();
  return JSON.parse(JSON.stringify(value)) as AuditValue;
};

const sameValue = (a: AuditValue, b: AuditValue) => JSON.stringify(a) === JSON.stringify(b);

/**
 * The audit entry's `changes`: `[before, after]` for each of `fields` whose
 * value differs, and nothing else. Every action names its own fields, so no
 * other column (care data included) can reach the log. A missing row (a
 * create, a delete) reads as nulls.
 */
export const auditChanges = <F extends string>(
  before: Partial<Record<F, unknown>> | null | undefined,
  after: Partial<Record<F, unknown>> | null | undefined,
  fields: readonly F[],
): AuditChanges => {
  const changes: AuditChanges = {};
  for (const field of fields) {
    const from = toAuditValue(before?.[field]);
    const to = toAuditValue(after?.[field]);
    if (!sameValue(from, to)) changes[field] = [from, to];
  }
  return changes;
};

const day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)));

/**
 * The audit log's filters (all optional): the staff member who acted, a
 * target (a user's or group's id, or part of a user's email or name or a
 * group's name), an action, and whole UTC days `from`–`to`.
 */
export const auditFilterZSchema = z.object({
  actorId: z.uuid().optional(),
  target: z.string().trim().min(1).max(254).optional(),
  action: z.enum(AUDIT_ACTIONS).optional(),
  from: day.optional(),
  to: day.optional(),
});
export type AuditFilter = z.infer<typeof auditFilterZSchema>;
