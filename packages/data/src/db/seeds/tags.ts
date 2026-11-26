import { eq } from "drizzle-orm";
import { getDb } from "../client";
import {
  TAG_TARGET_FIELDS,
  recordTagId,
  recordTagSchema,
  tagId,
  tagKey,
  tagName,
  tagSchema,
  userSchema,
} from "../schema";
import type { TagTarget, TagTargetIds } from "../schema";
import { appointmentIdIn } from "./appointments";
import { DEV_GROUP_ID } from "./careGroups";
import { SEED_GROUPS as MEDICATION_GROUPS } from "./medications";
import { SEED_GROUPS as PROVIDER_GROUPS } from "./providers";
import { seedRows as todoRows } from "./todos";

// Fictional tags on Dev Family's records (tags slice 1): a few shared tags,
// each on records of more than one type, so every target (a note, an event,
// a todo, a provider and a medication) carries one. Records are found by
// their seeds' titles and keys. Ids are derived (`tagId` with counter 0,
// `recordTagId`), so the seed is idempotent; append only.

type SeedTarget = { target: TagTarget; key: string };

export const DEV_FAMILY_TAGS: { name: string; on: SeedTarget[] }[] = [
  {
    name: "Home care search",
    on: [
      { target: "entry", key: "Questions for home care agencies" },
      { target: "entry", key: "Home care agency calls" },
    ],
  },
  {
    name: "Blood pressure",
    on: [
      { target: "medication", key: "lisinopril" },
      { target: "entry", key: "event:patel" },
      { target: "provider", key: "alvarez" },
    ],
  },
  {
    name: "Paperwork",
    on: [{ target: "todo", key: "Fax the insurance form" }],
  },
];

const devGroup = <T extends { groupId: string }>(groups: T[]) => {
  const group = groups.find((g) => g.groupId === DEV_GROUP_ID);
  if (!group) throw new Error("Seed tags: no Dev Family seeds");
  return group;
};

/** A seeded record's id, by its seed's title or key. */
const recordIdOf = ({ target, key }: SeedTarget) => {
  const found = (() => {
    switch (target) {
      case "entry":
        return key.startsWith("event:")
          ? appointmentIdIn(DEV_GROUP_ID, key.slice("event:".length))
          : devGroup(PROVIDER_GROUPS).entryIds.get(key);
      case "todo":
        return todoRows().find((t) => t.groupId === DEV_GROUP_ID && t.title === key)?.id;
      case "provider": {
        const group = devGroup(PROVIDER_GROUPS);
        const index = group.providers.findIndex((p) => p.key === key);
        return index < 0 ? undefined : group.providerId(index);
      }
      case "medication": {
        const group = devGroup(MEDICATION_GROUPS);
        const index = group.medications.findIndex((m) => m.key === key);
        return index < 0 ? undefined : group.medicationId(index);
      }
    }
  })();
  if (!found) throw new Error(`Seed tags name a missing ${target}: ${key}`);
  return found;
};

/** The seeded tags and links as rows (without their author). */
export const seedRows = () => {
  const tags = DEV_FAMILY_TAGS.map(({ name }) => ({
    id: tagId(DEV_GROUP_ID, name),
    groupId: DEV_GROUP_ID,
    name: tagName(name),
    nameKey: tagKey(name),
  }));
  const links = DEV_FAMILY_TAGS.flatMap(({ name, on }) =>
    on.map((record) => {
      const tag = tagId(DEV_GROUP_ID, name);
      const recordId = recordIdOf(record);
      return {
        id: recordTagId(tag, recordId),
        groupId: DEV_GROUP_ID,
        tagId: tag,
        ...({ [TAG_TARGET_FIELDS[record.target]]: recordId } as TagTargetIds),
      };
    }),
  );
  return { tags, links };
};

export const seed = async () => {
  const db = getDb();
  const [author] = await db
    .select({ id: userSchema.id })
    .from(userSchema)
    .where(eq(userSchema.email, "member@example.com"));
  if (!author) return;
  const audits = { createdBy: author.id, updatedBy: author.id };
  const { tags, links } = seedRows();
  await db
    .insert(tagSchema)
    .values(tags.map((t) => ({ ...t, ...audits })))
    .onConflictDoNothing({ target: tagSchema.id });
  await db
    .insert(recordTagSchema)
    .values(links.map((l) => ({ ...l, ...audits })))
    .onConflictDoNothing({ target: recordTagSchema.id });
};
