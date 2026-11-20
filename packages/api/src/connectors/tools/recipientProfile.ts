import { isError, recipientAllergyService } from "@caretook/data";
import { z } from "zod";
import { defineTool, READ_ANNOTATIONS } from "../registry";
import { recipientAge } from "./readSupport";
import { asMember, loadGroup } from "./shared";

const SEVERITY_RANK = { severe: 0, moderate: 1, mild: 2, unknown: 3 } as const;

/**
 * The care recipient's medical basics: names, age (never the birthday),
 * pronouns, language, code status, blood type, the note for helpers and
 * allergies. Their phones, email, address, insurance and emergency contacts
 * are never part of it.
 */
export const recipientProfile = defineTool({
  name: "recipient_profile",
  title: "Care recipient profile",
  description:
    "The care recipient's profile: name and preferred name, age (not the birthday), pronouns, primary language, code status, blood type, the note for helpers, and allergies (substance, reaction, severity, or that no known allergies is recorded). Contact details and insurance are not available.",
  scope: "read",
  input: z.object({}),
  annotations: READ_ANNOTATIONS,
  handler: async (_input, ctx) => {
    const loaded = await loadGroup(ctx);
    if (isError(loaded)) return loaded;
    const { recipient, timeZone } = loaded;
    if (!recipient)
      return { text: "No care recipient is set up for this group.", structured: { recipient: null } };

    const allergies = await recipientAllergyService.list(asMember(ctx), { groupId: ctx.groupId });
    if (isError(allergies)) return allergies;

    const profile = {
      name: recipient.name,
      preferredName: recipient.preferredName,
      age: recipientAge(recipient.dateOfBirth, ctx.now, timeZone),
      pronouns: recipient.pronouns,
      primaryLanguage: recipient.primaryLanguage,
      codeStatus: recipient.codeStatus,
      bloodType: recipient.bloodType,
      noteForHelpers: recipient.notes,
      timeZone,
      allergies: [...allergies.data]
        .sort(
          (a, b) =>
            SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || a.substance.localeCompare(b.substance),
        )
        .map((a) => ({ substance: a.substance, reaction: a.reaction, severity: a.severity })),
      noKnownAllergies: !!recipient.noKnownAllergiesAt && allergies.data.length === 0,
    };

    const text = [
      `${profile.preferredName || profile.name}${profile.preferredName ? ` (${profile.name})` : ""}${profile.age === null ? "" : `, age ${profile.age}`}.`,
      ...[
        profile.pronouns && `Pronouns: ${profile.pronouns}`,
        profile.primaryLanguage && `Language: ${profile.primaryLanguage}`,
        profile.codeStatus && `Code status: ${profile.codeStatus}`,
        profile.bloodType && `Blood type: ${profile.bloodType}`,
        profile.noteForHelpers && `Note for helpers: ${profile.noteForHelpers}`,
      ].filter(Boolean),
      profile.allergies.length
        ? `Allergies: ${profile.allergies.map((a) => `${a.substance}${a.reaction ? ` (${a.reaction})` : ""} [${a.severity}]`).join("; ")}.`
        : profile.noKnownAllergies
          ? "No known allergies."
          : "Allergies not recorded.",
    ].join("\n");
    return { text, structured: { recipient: profile } };
  },
});
