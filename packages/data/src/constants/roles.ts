// Global (account-level) roles stored on the user row. Care group roles
// (below) live on group membership, not here.
// `admin` and `support` are Caretook staff; what each may do is decided in
// one place, db/schema/staffRules.ts. Neither grants any care data.
export const USER_ROLE_NAMES = ["admin", "support", "member"] as const;

export type UserRoleName = (typeof USER_ROLE_NAMES)[number];

export const ROLES = [
  {
    name: "admin",
    description: "Caretook staff. Can manage every account, staff roles and settings.",
  },
  {
    name: "support",
    description: "Caretook support staff. Looks accounts up and helps with sign-in.",
  },
  {
    name: "member",
    description: "A caretaker using the app. Can manage their own account.",
  },
] as const satisfies readonly { name: UserRoleName; description: string }[];

export const isUserRoleName = (name: unknown): name is UserRoleName =>
  USER_ROLE_NAMES.some((role) => role === name);

// Care group roles, stored on care_group_member. They decide access to a
// group's data (see `group` in permissions). Global roles grant none of it:
// Caretook staff (`admin`) only see a group's data if they're a member.
// A member has exactly one. The two easy roles (easy roles PRD) always get
// the easy view: an Easy helper logs care, an Easy viewer reads.
export const GROUP_ROLE_NAMES = [
  "owner",
  "admin",
  "caretaker",
  "viewer",
  "easy_helper",
  "easy_viewer",
] as const;

export type GroupRoleName = (typeof GROUP_ROLE_NAMES)[number];

/** Where the role picker lists a role: the four regular ones, then "Easier to use". */
export type GroupRoleGroup = "regular" | "easier";

/**
 * Each role's label and description, in picker order. The descriptions are
 * shown to the managers who pick a role, never to the member: the easy
 * roles' "who it's for" lives only here, and the role's name says nothing
 * about the person.
 */
export const GROUP_ROLES = [
  {
    name: "owner",
    label: "Owner",
    group: "regular",
    description: "Manages the group, its members and owners. Can delete the group.",
  },
  {
    name: "admin",
    label: "Admin",
    group: "regular",
    description: "Manages members and invitations, but can't touch owners or delete the group.",
  },
  {
    name: "caretaker",
    label: "Caretaker",
    group: "regular",
    description: "Reads and writes care data.",
  },
  {
    name: "viewer",
    label: "Viewer",
    group: "regular",
    description: "Reads care data only.",
  },
  {
    name: "easy_helper",
    label: "Easy helper",
    group: "easier",
    description:
      "For someone who isn't comfortable with apps or who has memory or thinking difficulties. Large type, one screen, a few big buttons. They can log care and tick their own todos but can't change medications, providers or settings.",
  },
  {
    name: "easy_viewer",
    label: "Easy viewer",
    group: "easier",
    description:
      "For someone who isn't comfortable with apps or who has memory or thinking difficulties. Large type, one screen. They can read and tick their own todos but can't change anything else.",
  },
] as const satisfies readonly {
  name: GroupRoleName;
  label: string;
  group: GroupRoleGroup;
  description: string;
}[];

export const isGroupRoleName = (name: unknown): name is GroupRoleName =>
  GROUP_ROLE_NAMES.some((role) => role === name);

/** A role's label ("Easy helper"); an unknown role reads as it is. */
export const groupRoleLabel = (role: string): string =>
  GROUP_ROLES.find((r) => r.name === role)?.label ?? role;

// ---------------------------------------------------------------------------
// Role sets: the one place that says which roles may do what. Code checks a
// role against one of these, never against a role's name.
// ---------------------------------------------------------------------------

/** Roles that may manage a group's membership and invitations. */
export const GROUP_MANAGER_ROLES = ["owner", "admin"] as const satisfies readonly GroupRoleName[];
export const OWNER_ROLES = ["owner"] as const satisfies readonly GroupRoleName[];
/** Change the group's setup and anyone's data. */
export const WRITER_ROLES = ["owner", "admin", "caretaker"] as const satisfies readonly GroupRoleName[];
/** Log care (entries, doses, Given all): the writers and an Easy helper (on their own entries only). */
export const LOGGER_ROLES = [...WRITER_ROLES, "easy_helper"] as const satisfies readonly GroupRoleName[];
/** The roles that always get the easy view. */
export const EASY_ROLE_NAMES = ["easy_helper", "easy_viewer"] as const satisfies readonly GroupRoleName[];

/** Whether `role` is one of `set` (false for null or a role this build doesn't know). */
export const hasGroupRole = (set: readonly GroupRoleName[], role: string | null | undefined): boolean =>
  !!role && set.some((r) => r === role);

export const isWriterRole = (role: string | null | undefined) => hasGroupRole(WRITER_ROLES, role);
export const isLoggerRole = (role: string | null | undefined) => hasGroupRole(LOGGER_ROLES, role);
export const isEasyRole = (role: string | null | undefined) => hasGroupRole(EASY_ROLE_NAMES, role);
export const isManagerRole = (role: string | null | undefined) => hasGroupRole(GROUP_MANAGER_ROLES, role);
/** A logger who isn't a writer (an Easy helper): they change only the entries they created. */
export const isOwnRowLogger = (role: string | null | undefined) => isLoggerRole(role) && !isWriterRole(role);
