import type { ComboBoxOption } from "~/components/ui";

// The assignee picker's choices (pure; web:unit tests it): "Unassigned",
// then the group's members whose name matches what's typed (every word, at
// the start of a word, case and accents ignored), me first, then by name.
// A typed name that isn't a member's can be assigned as someone outside the
// group.

export const UNASSIGNED_OPTION = "\u0000unassigned";

export type AssigneeMember = { userId: string; name: string | null };

const fold = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();

/** A member's name on screen. */
export const memberName = (member: AssigneeMember, meId: string) =>
  `${member.name || "Member"}${member.userId === meId ? " (you)" : ""}`;

const matches = (name: string, typed: string) => {
  const words = fold(name).split(/\s+/);
  return fold(typed)
    .split(/\s+/)
    .filter(Boolean)
    .every((w) => words.some((word) => word.startsWith(w)));
};

export const assigneeOptions = (
  members: readonly AssigneeMember[],
  typed: string,
  meId: string,
): ComboBoxOption[] => {
  const sorted = [...members].sort((a, b) =>
    a.userId === meId ? -1 : b.userId === meId ? 1 : (a.name ?? "").localeCompare(b.name ?? ""),
  );
  const found = sorted
    .filter((m) => !typed.trim() || matches(m.name ?? "", typed))
    .map((m) => ({ id: m.userId, label: memberName(m, meId) }));
  return typed.trim() ? found : [{ id: UNASSIGNED_OPTION, label: "Unassigned" }, ...found];
};

/** Whether the typed text can be assigned as a name: not empty, and not exactly a member's name. */
export const canAssignName = (members: readonly AssigneeMember[], typed: string) =>
  !!typed.trim() && !members.some((m) => fold(m.name ?? "") === fold(typed));
