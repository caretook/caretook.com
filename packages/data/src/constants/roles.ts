// Global (account-level) roles stored on the user row. Care-circle roles
// (owner, caretaker, viewer, ...) will live on circle membership, not here.
export const USER_ROLE_NAMES = ["admin", "member"] as const;

export type UserRoleName = (typeof USER_ROLE_NAMES)[number];

export const ROLES = [
  {
    name: "admin",
    description: "Caretook staff. Can manage every account.",
  },
  {
    name: "member",
    description: "A caretaker using the app. Can manage their own account.",
  },
] as const satisfies readonly { name: UserRoleName; description: string }[];

export const isUserRoleName = (name: unknown): name is UserRoleName =>
  USER_ROLE_NAMES.some((role) => role === name);
