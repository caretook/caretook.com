import { isError, resolveUnits, SYSTEM_USER, userModel } from "@caretook/data";
import { CONNECTOR_READ_ONLY_BY_OWNER_LABEL } from "@caretook/data/schema";
import { z } from "zod";
import { defineTool, READ_ANNOTATIONS } from "../registry";
import { loadGroup, loadMembers } from "./shared";

/**
 * The group at a glance: its name, the care recipient's name and time zone,
 * the member's role and this connection's scope, their units, and the
 * members (names and roles only).
 */
export const groupOverview = defineTool({
  name: "group_overview",
  title: "Care group overview",
  description:
    "The care group this connection can see: its name, the care recipient's name and time zone (every time in other answers is in this zone), your role and whether this connection may add entries, your preferred units, and the members' names and roles. Call this first.",
  scope: "read",
  input: z.object({}),
  annotations: READ_ANNOTATIONS,
  handler: async (_input, ctx) => {
    const loaded = await loadGroup(ctx);
    if (isError(loaded)) return loaded;
    const members = await loadMembers(ctx);
    if (isError(members)) return members;
    // The member's own settings (units), read as the system: only `preferences` leaves here.
    const me = await userModel.getWholeById(ctx.authUser.id, { authUser: SYSTEM_USER });
    if (isError(me)) return me;

    const { group, recipient, timeZone } = loaded;
    const structured = {
      group: { name: group.name },
      recipient: recipient ? { preferredName: recipient.preferredName || recipient.name } : null,
      timeZone,
      you: {
        role: ctx.role,
        canAddEntries: ctx.scope === "readWrite",
        groupReadOnly: ctx.readOnlyByOwner ?? false,
      },
      units: resolveUnits(me?.preferences),
      members: members.map(({ name, role }) => ({ name, role })),
    };
    const who = structured.recipient ? ` for ${structured.recipient.preferredName}` : "";
    const text = [
      `${group.name}${who}. Time zone: ${timeZone}.`,
      `You are ${ctx.role === "admin" || ctx.role === "owner" ? "an" : "a"} ${ctx.role}; this connection ${
        structured.you.canAddEntries
          ? "can read and add entries"
          : structured.you.groupReadOnly
            ? `can only read (${CONNECTOR_READ_ONLY_BY_OWNER_LABEL})`
            : "can only read"
      }.`,
      `Members: ${members.map((m) => `${m.name ?? "Someone"} (${m.role})`).join(", ") || "none"}.`,
    ].join("\n");
    return { text, structured };
  },
});
