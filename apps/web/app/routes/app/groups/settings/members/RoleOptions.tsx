import { roleDescription, roleGroups, roleLabel } from "../groupSettings";

/**
 * A role `<select>`'s options, grouped: the regular roles, then the easy
 * roles under "Easier to use" (`roleGroups`). Each option's `title` is the
 * role's description, for the managers who pick it.
 */
export function RoleOptions({ roles }: { roles: readonly string[] }) {
  return (
    <>
      {roleGroups(roles).map((group) => (
        <optgroup key={group.id} label={group.label} data-role-group={group.id}>
          {group.roles.map((role) => (
            <option key={role} value={role} title={roleDescription(role)}>
              {roleLabel(role)}
            </option>
          ))}
        </optgroup>
      ))}
    </>
  );
}
