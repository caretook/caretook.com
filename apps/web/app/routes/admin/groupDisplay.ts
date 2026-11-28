import type { StaffSettableGroupRole } from "@caretook/data/domain";
import { STAFF_SETTABLE_GROUP_ROLES } from "@caretook/data/domain";

// How care groups read in /admin (admin slice 4): the Groups list and a
// group's page. Pure, tested.

type GroupRoleName = "owner" | StaffSettableGroupRole;

const ROLE_ORDER: readonly GroupRoleName[] = [
  "owner",
  "admin",
  "caretaker",
  "viewer",
  "easy_helper",
  "easy_viewer",
];

type Person = { name: string | null; email: string };

/** A person as staff see them: name and email, or the email alone. */
export const personLabel = (person: Person) =>
  person.name ? `${person.name} (${person.email})` : person.email;

/** Members by role (owners first), then by name or email. */
export const sortGroupMembers = <M extends Person & { role: string }>(members: readonly M[]) =>
  [...members].sort(
    (a, b) =>
      ROLE_ORDER.indexOf(a.role as GroupRoleName) - ROLE_ORDER.indexOf(b.role as GroupRoleName) ||
      (a.name || a.email).localeCompare(b.name || b.email, "en", { sensitivity: "base" }),
  );

/** The roles Change role offers a member: every role staff may set but the one they have. */
export const changeRoleOptions = (role: string): StaffSettableGroupRole[] =>
  STAFF_SETTABLE_GROUP_ROLES.filter((r) => r !== role);

/** The group's name as staff see it: "<group> · for <recipient>" (preferred name in brackets). */
export const recipientLabel = (group: {
  recipientName: string | null;
  recipientPreferredName: string | null;
}) =>
  !group.recipientName
    ? "No care recipient"
    : group.recipientPreferredName && group.recipientPreferredName !== group.recipientName
      ? `${group.recipientName} (${group.recipientPreferredName})`
      : group.recipientName;

/** A count with its noun: "1 entry", "3 entries". */
export const countText = (n: number, one: string, many: string) =>
  `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;

/** A day in UTC (staff work across zones), or "Never". */
export const dayText = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-US", { dateStyle: "medium", timeZone: "UTC" }) : "Never";

export type MemberAction = "promoteOwner" | "changeRole" | "removeMember";

/** What each action's dialog says. */
export const memberActionText = (
  action: MemberAction,
  member: Person,
  groupName: string,
): { title: string; confirm: string; message: string } => {
  const who = member.name || member.email;
  switch (action) {
    case "promoteOwner":
      return {
        title: `Make ${who} an owner?`,
        confirm: "Make owner",
        message: `${who} will manage ${groupName}, its members and owners. Members see the change in Members.`,
      };
    case "changeRole":
      return {
        title: `Change ${who}'s role?`,
        confirm: "Change role",
        message: `Members of ${groupName} see the change in Members. A group always keeps at least one owner.`,
      };
    case "removeMember":
      return {
        title: `Remove ${who} from ${groupName}?`,
        confirm: "Remove",
        message: `${who} loses access to the group's care data on their next sync. A group always keeps at least one owner.`,
      };
  }
};
