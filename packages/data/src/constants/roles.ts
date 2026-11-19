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
export const GROUP_ROLE_NAMES = ["owner", "admin", "caretaker", "viewer"] as const;

export type GroupRoleName = (typeof GROUP_ROLE_NAMES)[number];

export const GROUP_ROLES = [
  {
    name: "owner",
    description: "Manages the group, its members and owners. Can delete the group.",
  },
  {
    name: "admin",
    description: "Manages members and invitations, but can't touch owners or delete the group.",
  },
  {
    name: "caretaker",
    description: "Reads and writes care data.",
  },
  {
    name: "viewer",
    description: "Reads care data only.",
  },
] as const satisfies readonly { name: GroupRoleName; description: string }[];

export const isGroupRoleName = (name: unknown): name is GroupRoleName =>
  GROUP_ROLE_NAMES.some((role) => role === name);

/** Roles that may manage a group's membership and invitations. */
export const GROUP_MANAGER_ROLES = ["owner", "admin"] as const satisfies readonly GroupRoleName[];
