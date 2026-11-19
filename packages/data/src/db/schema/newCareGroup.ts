import { z } from "zod";

// "Who do you care for?": the form that starts a care group, shared by the
// New care group sheet, /join/:code and the API (invites slice 5). Pure and
// client-safe.

/** "<preferred or first name>'s care", the group name when none is given. */
export const defaultGroupName = ({
  recipientName,
  preferredName,
}: {
  recipientName: string;
  preferredName?: string | null;
}): string => {
  const preferred = preferredName?.trim();
  const first = recipientName.trim().split(/\s+/)[0] ?? "";
  const who = preferred || first;
  return who ? `${who}'s care` : "Our care group";
};

const recipientName = z.string().trim().min(1, "Enter their name").max(120, "At most 120 characters");
const preferredName = z.string().trim().max(120, "At most 120 characters").nullish();
const groupName = z.string().trim().max(120, "At most 120 characters").nullish();

/** What the form sends. An empty preferred name or group name is none. */
export const newCareGroupZSchema = z.object({ recipientName, preferredName, groupName });
export type NewCareGroupInput = z.input<typeof newCareGroupZSchema>;

/** The group and recipient to create: the group name defaults from the recipient's names. */
export const resolveNewCareGroup = (input: z.output<typeof newCareGroupZSchema>) => {
  const preferred = input.preferredName?.trim() || null;
  return {
    name:
      input.groupName?.trim() ||
      defaultGroupName({ recipientName: input.recipientName, preferredName: preferred }),
    recipient: { name: input.recipientName.trim(), preferredName: preferred },
  };
};
