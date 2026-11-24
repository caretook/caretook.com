import { roleGroups, roleLabel } from "../groupSettings";

/**
 * A role `<select>`'s options, grouped: the regular roles, then the easy
 * roles under "Easier to use" (`roleGroups`). What each role may do is in
 * `RoleHelp` beside the picker's label (an option can't hold a second line).
 */
export function RoleOptions({ roles }: { roles: readonly string[] }) {
  return (
    <>
      {roleGroups(roles).map((group) => (
        <optgroup key={group.id} label={group.label} data-role-group={group.id}>
          {group.roles.map((role) => (
            <option key={role} value={role}>
              {roleLabel(role)}
            </option>
          ))}
        </optgroup>
      ))}
    </>
  );
}
