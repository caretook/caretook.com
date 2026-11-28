import { isError, PROVIDER_TYPES, providerService } from "@caretook/data";
import { z } from "zod";
import { defineTool, READ_ANNOTATIONS } from "../registry";
import { LIST_PAGE_MAX, pageOf, pagingInput } from "./readSupport";
import { asMember, loadGroup } from "./shared";
import { tagsByRecord, tagsOf, tagsSuffix } from "./tagSupport";

const input = z.object({
  type: z.enum(PROVIDER_TYPES).optional().describe("Only this type of provider."),
  includePast: z.boolean().optional().describe("Also past providers. Default: current only."),
  ...pagingInput,
});

/**
 * The care group's providers. A clinician's, practice's or pharmacy's phone
 * numbers and address come with them (a business directory); an "other"
 * contact (an aide, a neighbor) can be a private person, so only their name,
 * role and status do. Emails are never returned.
 */
export const listProviders = defineTool({
  name: "list_providers",
  title: "List providers",
  description: `The care group's providers: clinicians (with specialty and practice), practices, pharmacies and other contacts, the primary ones first. Clinicians', practices' and pharmacies' phone numbers and addresses are included; other contacts show name and role only. Each has its tags. Current by default. At most ${LIST_PAGE_MAX} a page; pass nextCursor back for more.`,
  scope: "read",
  input,
  annotations: READ_ANNOTATIONS,
  handler: async (args, ctx) => {
    const loaded = await loadGroup(ctx);
    if (isError(loaded)) return loaded;
    const res = await providerService.list(asMember(ctx), { groupId: ctx.groupId });
    if (isError(res)) return res;
    const nameOf = (id: string | null) => (id ? (res.data.find((p) => p.id === id)?.name ?? null) : null);

    const wanted = res.data
      .filter((p) => (args.includePast || p.status === "current") && (!args.type || p.type === args.type))
      .sort(
        (a, b) =>
          Number(b.isPrimary) - Number(a.isPrimary) ||
          Number(a.status !== "current") - Number(b.status !== "current") ||
          a.name.localeCompare(b.name, undefined, { sensitivity: "base" }) ||
          a.id.localeCompare(b.id),
      );
    const page = pageOf(wanted, args);
    const byRecord = await tagsByRecord(ctx);
    if (isError(byRecord)) return byRecord;

    const providers = page.items.map((p) => {
      const business = p.type !== "other";
      return {
        id: p.id,
        type: p.type,
        name: p.name,
        specialty: p.specialty,
        practice: nameOf(p.practiceId),
        status: p.status,
        primary: p.isPrimary,
        phones: business ? p.phones : [],
        address: business ? p.address : null,
        website: business ? p.website : null,
        tags: tagsOf(byRecord, p.id),
      };
    });

    const line = (p: (typeof providers)[number]) =>
      `- ${p.name} (${[p.type, p.specialty, p.practice, p.primary ? "primary" : null, p.status === "past" ? "past" : null].filter(Boolean).join(", ")})${p.phones.length ? ` ${p.phones.map((n) => `${n.label}: ${n.number}`).join("; ")}` : ""}${tagsSuffix(p.tags)}`;
    const text = providers.length
      ? [
          `${providers.length} provider${providers.length === 1 ? "" : "s"}:`,
          ...providers.map(line),
          ...(page.nextCursor ? ["More: call again with nextCursor."] : []),
        ].join("\n")
      : "No providers.";
    return { text, structured: { providers, nextCursor: page.nextCursor } };
  },
});
