import {
  conditionSinceWords,
  isError,
  providerService,
  recipientAllergyService,
  recipientConditionService,
  sortConditions,
} from "@caretook/data";
import { z } from "zod";
import { defineTool, READ_ANNOTATIONS } from "../registry";
import { recipientAge } from "./readSupport";
import { asMember, loadGroup } from "./shared";

const SEVERITY_RANK = { severe: 0, moderate: 1, mild: 2, unknown: 3 } as const;

/**
 * The care recipient's medical basics: names, age (never the birthday),
 * pronouns, language, code status, blood type, the note for helpers,
 * allergies and conditions (with the providers' names). Their phones, email, address, insurance and emergency contacts
 * are never part of it.
 */
export const recipientProfile = defineTool({
  name: "recipient_profile",
  title: "Care recipient profile",
  description:
    "The care recipient's profile: name and preferred name, age (not the birthday), pronouns, primary language, code status, blood type, the note for helpers, allergies (substance, reaction, severity, or that no known allergies is recorded), and conditions (name, active or resolved, since, note, who diagnosed it and which providers manage it by name, active first, or that no known conditions is recorded). Contact details and insurance are not available.",
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

    const conditions = await recipientConditionService.list(asMember(ctx), { groupId: ctx.groupId });
    if (isError(conditions)) return conditions;
    // Deleted providers too, to know which links to leave out.
    const providers = await providerService.list(asMember(ctx), {
      groupId: ctx.groupId,
      includeDeleted: true,
    });
    if (isError(providers)) return providers;
    const liveName = new Map(providers.data.filter((p) => !p.deletedAt).map((p) => [p.id, p.name]));
    const conditionList = [];
    for (const c of sortConditions(conditions.data)) {
      const links = await recipientConditionService.listManagers(asMember(ctx), c.id);
      if (isError(links)) return links;
      const managedBy = links.data
        .map((l) => liveName.get(l.providerId))
        .filter((n): n is string => !!n)
        .sort((a, b) => a.localeCompare(b));
      conditionList.push({
        name: c.name,
        status: c.status,
        since: conditionSinceWords(c.sinceYear, c.sinceMonth),
        note: c.note,
        // A deleted provider is left out, never sent as a live one.
        diagnosedBy: (c.diagnosedById && liveName.get(c.diagnosedById)) || null,
        managedBy,
      });
    }

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
      conditions: conditionList,
      noKnownConditions: !!recipient.noKnownConditionsAt && conditionList.length === 0,
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
      profile.conditions.length
        ? `Conditions: ${profile.conditions
            .map((c) => {
              const bits = [
                c.status === "resolved" ? "resolved" : null,
                c.since && `since ${c.since}`,
                c.note?.trim() || null,
                c.diagnosedBy && `diagnosed by ${c.diagnosedBy}`,
                c.managedBy.length ? `managed by ${c.managedBy.join(", ")}` : null,
              ].filter(Boolean);
              return `${c.name}${bits.length ? ` (${bits.join("; ")})` : ""}`;
            })
            .join("; ")}.`
        : profile.noKnownConditions
          ? "No known conditions."
          : "Conditions not recorded.",
    ].join("\n");
    return { text, structured: { recipient: profile } };
  },
});
