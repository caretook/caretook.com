import type { MyGroup } from "../core/rpc";
import type { GroupRow } from "../timeline/timeline.sync";

import { WRITER_ROLES } from "../timeline/timeline.sync";

// The care group a group route is about, as its layout loads it once per
// navigation (`routes/app/groups/layout`). Pure: no database or React here,
// so web:unit can test it. `lib/app-shell/group.tsx` loads it and serves it to loaders
// (the router context) and components (`useGroup()`).

export type GroupRecipient = Readonly<{
  id: string;
  name: string;
  preferredName: string | null;
  /** The preferred name, else the name. */
  displayName: string;
  /** Where they live (IANA): medication times are in it. Null until it has synced. */
  timeZone: string | null;
}>;

/** Everything a group screen may read about its group. Nothing else is loaded. */
export type GroupContext = Readonly<{
  /** The signed-in user. */
  userId: string;
  id: string;
  name: string;
  /** What the group is called on screen: the recipient's display name, else the group's name. */
  displayName: string;
  /** Your role in the group (null for a role this build doesn't know). */
  role: MyGroup["role"];
  /** Whether you may add, change and delete entries. */
  canWrite: boolean;
  recipient: GroupRecipient | null;
  /** Simple mode as the group's managers set it for you: their default, and whether you're locked in it. */
  simpleMode: Readonly<{ ownerDefault: boolean; locked: boolean }>;
}>;

/** The context for one of `userId`'s local group rows. */
export const toGroupContext = (row: GroupRow, userId: string): GroupContext => {
  const recipient: GroupRecipient | null = row.recipient_id
    ? {
        id: row.recipient_id,
        name: row.recipient_name ?? "",
        preferredName: row.recipient_preferred_name || null,
        displayName: row.recipient_preferred_name || row.recipient_name || "",
        timeZone: row.recipient_time_zone || null,
      }
    : null;
  const name = row.name ?? "";
  return {
    userId,
    id: row.id,
    name,
    displayName: recipient?.displayName || name,
    role: (row.role ?? null) as MyGroup["role"],
    canWrite: !!row.role && WRITER_ROLES.includes(row.role),
    recipient,
    simpleMode: { ownerDefault: !!row.simple_mode, locked: !!row.simple_mode_locked },
  };
};
