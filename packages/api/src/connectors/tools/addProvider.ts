import type { NewProviderDraft } from "@caretook/data";

import {
  foldSearchText,
  isError,
  newError,
  newItemPreview,
  PROVIDER_LIMITS,
  PROVIDER_TYPES,
  providerPhoneZSchema,
  providerService,
} from "@caretook/data";
import { z } from "zod";
import { linkTo, providerPath } from "../links";
import { defineTool, WRITE_ANNOTATIONS } from "../registry";
import { asMember } from "./shared";

// add_provider (connectors-3): a member's assistant adds a clinician,
// practice, pharmacy or other contact to the group's directory with the Add
// provider sheet's fields and checks (`providerService.create` as the
// member). No email, primary or status: those stay the sheet's. A live
// provider of the same type and name is answered, not added again.

const text = (max: number, what: string) => z.string().max(max).optional().describe(what);

const input = z.object({
  type: z
    .enum(PROVIDER_TYPES)
    .default("clinician")
    .describe(
      "clinician (a person who treats), practice, pharmacy or other (an aide, a neighbor). Default: clinician.",
    ),
  name: z
    .string()
    .trim()
    .min(1)
    .max(PROVIDER_LIMITS.name)
    .describe('The name as people say it: "Dr. Maya Chen", "Riverside Dialysis".'),
  specialty: text(PROVIDER_LIMITS.specialty, 'What they do: "Cardiology", "Home health aide".'),
  practiceId: z
    .uuid()
    .optional()
    .describe("A clinician's or other contact's practice or pharmacy: its id from list_providers."),
  phones: z
    .array(providerPhoneZSchema)
    .max(PROVIDER_LIMITS.phones)
    .optional()
    .describe(
      `Up to ${PROVIDER_LIMITS.phones} phone numbers, each a number and an optional label ("Office").`,
    ),
  address: text(PROVIDER_LIMITS.address, "A street address."),
  website: text(PROVIDER_LIMITS.website, 'A web address, like "clinic.example".'),
});

/** A name as the duplicate check compares it: folded, its spacing collapsed. */
const nameKey = (name: string) => foldSearchText(name).replace(/\s+/g, " ").trim();

export const addProvider = defineTool({
  name: "add_provider",
  title: "Add a provider",
  description:
    "Add a clinician, practice, pharmacy or other contact to the care group's provider directory: type, name, specialty, phone numbers, address and website. A clinician's practice is a practice's or pharmacy's id from list_providers; check list_providers first, since one of the same type and name isn't added twice. Ask the member before calling.",
  scope: "readWrite",
  input,
  annotations: WRITE_ANNOTATIONS,
  handler: async (args, ctx) => {
    const directory = await providerService.list(asMember(ctx), { groupId: ctx.groupId });
    if (isError(directory)) return directory;
    const providerUrl = (id: string) => linkTo(ctx.origin, providerPath(ctx.groupId, id));

    const key = nameKey(args.name);
    const same = directory.data.find((p) => p.type === args.type && nameKey(p.name) === key);
    if (same) {
      const url = providerUrl(same.id);
      return {
        text: [`Already in the directory, nothing added: ${same.name}`, url].join("\n"),
        structured: { providerId: same.id, alreadyThere: true, url },
      };
    }

    const provider = await providerService.create(asMember(ctx), {
      groupId: ctx.groupId,
      type: args.type,
      name: args.name,
      specialty: args.specialty,
      practiceId: args.practiceId,
      phones: args.phones,
      address: args.address,
      website: args.website,
    });
    if (isError(provider)) return provider;
    if (!provider) return newError({ code: "providerService:notFound" });

    const draft: NewProviderDraft = {
      kind: "provider",
      type: provider.type,
      name: provider.name,
      specialty: provider.specialty,
      practiceId: provider.practiceId,
      phone: provider.phones[0]?.number ?? null,
      address: provider.address,
    };
    const preview = newItemPreview(draft, (id) => directory.data.find((p) => p.id === id)?.name);
    const url = providerUrl(provider.id);
    const line = [preview.title, preview.detail].filter(Boolean).join(" · ");
    return {
      text: [`Added provider: ${line}`, url].join("\n"),
      structured: { providerId: provider.id, preview, url },
    };
  },
});
