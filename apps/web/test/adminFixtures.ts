import type { AppSettingKey, StaffCapability } from "@caretook/data/schema";
import type { ApiOutputs } from "~/lib/rpc";
import type { AuditEntryView } from "~/routes/admin/AuditEntryList";
import type { SettingRow } from "~/routes/admin/settings/SettingCard";

import { APP_SETTINGS, staffCapabilities } from "@caretook/data/schema";

// Loader data builders for /admin's pages (web only, server loaders): what
// the API answers, as the page's loader gets it, with fictional defaults.
// Give them to a route's `loaderData` (renderWithDevice). The loaders' own
// queries are tested through the API in packages/api (*Admin.int.test.ts).
//
//   loaderData: { users: [adminFx.userRow({ email: "pat@example.com" })], count: 1, … }
//
// All names and addresses are made up.

type UserPage = ApiOutputs["admin"]["users"]["get"];
type UserRow = ApiOutputs["admin"]["users"]["search"]["users"][number];
type GroupRow = ApiOutputs["admin"]["groups"]["search"]["groups"][number];
type GroupPage = ApiOutputs["admin"]["groups"]["get"];
type GroupMember = GroupPage["members"][number];

let n = 0;
/** A stable-looking UUID, new on every call. */
const nextId = () => `5a7d0c00-0000-4000-8000-${String(++n).padStart(12, "0")}`;

const DAY = "2026-11-10T17:30:00.000Z";

export type StaffPerson = { id: string; name: string; email: string };

/** Staff members: an admin and a support agent. */
export const ADMIN_STAFF: StaffPerson = {
  id: "5a7d0c00-aaaa-4000-8000-000000000001",
  name: "Dana Reyes",
  email: "dana.admin@example.com",
};
export const SUPPORT_STAFF: StaffPerson = {
  id: "5a7d0c00-aaaa-4000-8000-000000000002",
  name: "Robin Hale",
  email: "robin.support@example.com",
};

/** A staff role's capabilities, as `requireStaff` gives them to the pages. */
export const capabilitiesOf = (role: "admin" | "support"): StaffCapability[] => staffCapabilities([role]);

export const adminFx = {
  /** One row of /admin/users (`admin.users.search`). */
  userRow: (v: Partial<UserRow> = {}): UserRow => ({
    id: nextId(),
    name: "Pat Lindqvist",
    email: "pat.lindqvist@example.com",
    emailVerified: true,
    role: "member",
    createdAt: DAY,
    disabled: false,
    ...v,
  }),

  /** A session on an account's page. */
  session: (v: Partial<UserPage["sessions"][number]> = {}): UserPage["sessions"][number] => ({
    id: nextId(),
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    ipAddress: "203.0.113.7",
    createdAt: DAY,
    lastActiveAt: DAY,
    expiresAt: "2026-12-10T17:30:00.000Z",
    ...v,
  }),

  /** A group on an account's page. */
  membership: (v: Partial<UserPage["groups"][number]> = {}): UserPage["groups"][number] => ({
    groupId: nextId(),
    displayName: "Grandma June",
    groupName: "Lindqvist Family",
    role: "owner",
    joinedAt: DAY,
    invitedBy: null,
    ...v,
  }),

  /** A row of an account's recent mail. */
  mail: (v: Partial<UserPage["mail"][number]> = {}): UserPage["mail"][number] => ({
    id: nextId(),
    template: "resetPassword",
    status: "sent",
    attempts: 1,
    queuedAt: DAY,
    sentAt: DAY,
    errorCode: null,
    ...v,
  }),

  /** An account's page (`admin.users.get`): a confirmed member with a password and no sessions. */
  userPage: ({
    account,
    signIn,
    ...v
  }: Partial<Omit<UserPage, "account" | "signIn">> & {
    account?: Partial<UserPage["account"]>;
    signIn?: Partial<UserPage["signIn"]>;
  } = {}): UserPage => ({
    account: {
      id: nextId(),
      name: "Pat Lindqvist",
      email: "pat.lindqvist@example.com",
      emailVerified: true,
      role: "member",
      createdAt: DAY,
      disabledAt: null,
      disabledBy: null,
      disabledReason: null,
      ...account,
    },
    signIn: { password: true, emailed: true, lastSignInAt: null, ...signIn },
    sessions: [],
    groups: [],
    mail: [],
    ...v,
  }),

  /** One audit log entry, by the admin unless `actor` says otherwise. */
  auditEntry: (v: Partial<AuditEntryView> = {}): AuditEntryView => ({
    id: nextId(),
    action: "accessCode.create",
    actor: ADMIN_STAFF,
    targetUser: null,
    targetGroup: null,
    reason: null,
    changes: {},
    createdAt: DAY,
    ...v,
  }),

  /** One row of /admin/groups (`admin.groups.search`). */
  groupRow: (v: Partial<GroupRow> = {}): GroupRow => ({
    id: nextId(),
    name: "Lindqvist Family",
    recipientName: "June Lindqvist",
    recipientPreferredName: "Grandma June",
    memberCount: 2,
    owners: [{ id: nextId(), name: "Pat Lindqvist", email: "pat.lindqvist@example.com" }],
    createdAt: DAY,
    ...v,
  }),

  /** A member on a group's staff page. */
  member: (v: Partial<GroupMember> = {}): GroupMember => ({
    userId: nextId(),
    name: "Pat Lindqvist",
    email: "pat.lindqvist@example.com",
    role: "owner",
    joinedAt: DAY,
    invitedBy: null,
    ...v,
  }),

  /** A group's staff page (`admin.groups.get`). */
  groupPage: (v: Partial<GroupPage> = {}): GroupPage => ({
    id: nextId(),
    name: "Lindqvist Family",
    recipientName: "June Lindqvist",
    recipientPreferredName: "Grandma June",
    createdAt: DAY,
    lastActivityAt: DAY,
    counts: { entries: 12, providers: 2, medications: 3 },
    members: [],
    ...v,
  }),

  /** One setting on /admin/settings, at its default unless `value` is given. */
  setting: <K extends AppSettingKey>(key: K, v: Partial<SettingRow> = {}): SettingRow => ({
    key,
    value: APP_SETTINGS[key].default,
    isDefault: !("value" in v),
    updatedAt: "value" in v ? DAY : null,
    ...v,
  }),
};
