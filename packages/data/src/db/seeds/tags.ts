import { inArray } from "drizzle-orm";
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
import type { TagColor, TagTarget, TagTargetIds } from "../schema";
import { appointmentIdIn } from "./appointments";
import { DEV_GROUP_ID } from "./careGroups";
import { SEED_GROUPS as MEDICATION_GROUPS } from "./medications";
import {
  MORE_GROUPS,
  entryId as moreEntryId,
  groupId as moreGroupId,
  medicationId as moreMedicationId,
  providerId as moreProviderId,
} from "./moreGroups";
import { SEED_GROUPS as PROVIDER_GROUPS } from "./providers";
import { SECOND_GROUP_ID, entryId as secondEntryId } from "./secondGroup";
import {
  TEDDER_APPOINTMENTS,
  TEDDER_GROUP_ID,
  TEDDER_MEDICATIONS,
  TEDDER_PROVIDERS,
  TEDDER_TODOS,
  seedRows as tedderRows,
} from "./tedderFamily";
import { entryId as devEntryId } from "./timelineEntries";
import { seedRows as todoRows } from "./todos";

// Fictional tags on every seed group's records (tags slice 1; more groups and
// colors in tags-2): a few shared tags per group, each on records of more
// than one type, so every target (a note, an event, a todo, a provider and a
// medication) carries one. Records are found by their seeds' titles and keys:
// an entry by its title, `#<n>` (its place in the group's entry seeds) or
// `event:<key>` (a seeded event); a todo by its title; a provider or a
// medication by its key. Ids are derived (`tagId` with counter 0,
// `recordTagId`), so the seed is idempotent; append only. Each tag has a
// palette color (`TAG_COLORS`), one per tag in a group.

type SeedTarget = { target: TagTarget; key: string };
type SeedTag = { name: string; color: TagColor; on: SeedTarget[] };

export const DEV_FAMILY_TAGS: SeedTag[] = [
  {
    name: "Home care search",
    color: "sky",
    on: [
      { target: "entry", key: "Questions for home care agencies" },
      { target: "entry", key: "Home care agency calls" },
    ],
  },
  {
    name: "Blood pressure",
    color: "coral",
    on: [
      { target: "medication", key: "lisinopril" },
      { target: "entry", key: "event:patel" },
      { target: "provider", key: "alvarez" },
    ],
  },
  {
    name: "Paperwork",
    color: "ochre",
    on: [{ target: "todo", key: "Fax the insurance form" }],
  },
  {
    name: "Physical therapy",
    color: "fern",
    on: [
      { target: "entry", key: "Physical therapy evaluation" },
      { target: "entry", key: "PT visits approved" },
      { target: "entry", key: "event:therapy" },
      { target: "todo", key: "Drive Pat to physio" },
    ],
  },
  {
    name: "Eyes",
    color: "violet",
    on: [
      { target: "entry", key: "Eye exam" },
      { target: "entry", key: "event:eyesNew" },
      { target: "medication", key: "latanoprost" },
      { target: "todo", key: "Book the eye appointment" },
      { target: "todo", key: "Refill Latanoprost" },
    ],
  },
  {
    name: "Hospital stay",
    color: "rose",
    on: [
      { target: "entry", key: "Urgent care, sent on to the ER" },
      { target: "entry", key: "Discharged from the ER" },
      { target: "todo", key: "Get ready for the hospital stay" },
      { target: "medication", key: "amoxicillin" },
      { target: "provider", key: "mercy" },
    ],
  },
  {
    name: "Good days",
    color: "moss",
    on: [
      { target: "entry", key: "#0" },
      { target: "todo", key: "Water the plants" },
    ],
  },
];

/** Grandpa Lou's (Dev Family 2). */
export const SECOND_GROUP_TAGS: SeedTag[] = [
  {
    name: "Hearing",
    color: "sky",
    on: [
      { target: "entry", key: "Hearing aid fitting" },
      { target: "entry", key: "event:lindqvist" },
      { target: "provider", key: "lindqvist" },
    ],
  },
  {
    name: "Good days",
    color: "moss",
    on: [
      { target: "entry", key: "#0" },
      { target: "entry", key: "#4" },
      { target: "todo", key: "Renew Lou's bus pass" },
    ],
  },
  {
    name: "Evening routine",
    color: "violet",
    on: [
      { target: "medication", key: "tamsulosin" },
      { target: "medication", key: "barrierCream" },
    ],
  },
];

/** Tedder Family's. */
export const TEDDER_TAGS: SeedTag[] = [
  {
    name: "Hearing",
    color: "sky",
    on: [
      { target: "entry", key: "#2" },
      { target: "provider", key: "audiology" },
      { target: "todo", key: "Order new hearing aid batteries" },
    ],
  },
  {
    name: "Knee",
    color: "fern",
    on: [
      { target: "entry", key: "event:knee" },
      { target: "provider", key: "lindqvist" },
      { target: "medication", key: "acetaminophen" },
    ],
  },
  {
    name: "Heart health",
    color: "coral",
    on: [
      { target: "medication", key: "lisinopril" },
      { target: "medication", key: "atorvastatin" },
      { target: "entry", key: "event:brooks" },
      { target: "provider", key: "brooks" },
      { target: "todo", key: "Write down questions for Dr. Brooks" },
    ],
  },
  {
    name: "Around the house",
    color: "ochre",
    on: [
      { target: "entry", key: "#0" },
      { target: "todo", key: "Fix the loose stair rail" },
      { target: "todo", key: "Look into a shower chair" },
    ],
  },
];

/** Each of the more groups (B-90) gets the same two: its doctor and its medicine. */
const moreGroupTags = (group: (typeof MORE_GROUPS)[number]): SeedTag[] => {
  const event = group.entries.find((e) => e.kind === "event")?.title;
  const note = group.entries.findIndex((e) => e.kind === "note");
  return [
    {
      name: "Doctor visits",
      color: "blue",
      on: [
        { target: "provider", key: group.provider.name },
        ...(event ? [{ target: "entry" as const, key: event }] : []),
      ],
    },
    {
      name: "Medicines",
      color: "orchid",
      on: [
        { target: "medication", key: group.medication.content.name },
        ...(note >= 0 ? [{ target: "entry" as const, key: `#${note}` }] : []),
      ],
    },
  ];
};

type TagGroup = {
  groupId: string;
  /** Who the group's tags and links are by (an owner). */
  author: string;
  tags: SeedTag[];
  idOf: (record: SeedTarget) => string | undefined;
};

const index = (key: string) => (/^#\d+$/.test(key) ? Number(key.slice(1)) : null);

/** Dev Family and Dev Family 2 share their seeds' lookups. */
const devLike = (groupId: string, entryIdAt: (i: number) => string, tags: SeedTag[]): TagGroup => ({
  groupId,
  author: "member@example.com",
  tags,
  idOf: ({ target, key }) => {
    switch (target) {
      case "entry": {
        if (key.startsWith("event:")) return appointmentIdIn(groupId, key.slice("event:".length));
        const at = index(key);
        if (at !== null) return entryIdAt(at);
        return PROVIDER_GROUPS.find((g) => g.groupId === groupId)?.entryIds.get(key);
      }
      case "todo":
        return todoRows().find((t) => t.groupId === groupId && t.title === key)?.id;
      case "provider": {
        const group = PROVIDER_GROUPS.find((g) => g.groupId === groupId);
        const at = group?.providers.findIndex((p) => p.key === key) ?? -1;
        return group && at >= 0 ? group.providerId(at) : undefined;
      }
      case "medication": {
        const group = MEDICATION_GROUPS.find((g) => g.groupId === groupId);
        const at = group?.medications.findIndex((m) => m.key === key) ?? -1;
        return group && at >= 0 ? group.medicationId(at) : undefined;
      }
    }
  },
});

const tedderGroup = (): TagGroup => {
  const rows = tedderRows();
  const at = <T extends { key: string }>(list: T[], key: string) => {
    const i = list.findIndex((x) => x.key === key);
    return i < 0 ? undefined : i;
  };
  return {
    groupId: TEDDER_GROUP_ID,
    author: "tedder@example.com",
    tags: TEDDER_TAGS,
    idOf: ({ target, key }) => {
      switch (target) {
        case "entry": {
          if (key.startsWith("event:")) {
            const i = at(TEDDER_APPOINTMENTS, key.slice("event:".length));
            return i === undefined ? undefined : rows.appointments[i]?.id;
          }
          const i = index(key);
          return i === null ? undefined : rows.entries[i]?.row.id;
        }
        case "todo": {
          const i = TEDDER_TODOS.findIndex((t) => t.title === key);
          return i < 0 ? undefined : rows.todos[i]?.id;
        }
        case "provider": {
          const i = at(TEDDER_PROVIDERS, key);
          return i === undefined ? undefined : rows.providers[i]?.id;
        }
        case "medication": {
          const i = at(TEDDER_MEDICATIONS, key);
          return i === undefined ? undefined : rows.medications[i]?.row.id;
        }
      }
    },
  };
};

const moreGroups = (): TagGroup[] =>
  MORE_GROUPS.map((group, g) => ({
    groupId: moreGroupId(g),
    author: group.members.find((m) => m.role === "owner")!.email,
    tags: moreGroupTags(group),
    idOf: ({ target, key }) => {
      switch (target) {
        case "entry": {
          const i = index(key) ?? group.entries.findIndex((e) => e.title === key);
          return i >= 0 && i < group.entries.length ? moreEntryId(g, i) : undefined;
        }
        case "provider":
          return key === group.provider.name ? moreProviderId(g) : undefined;
        case "medication":
          return key === group.medication.content.name ? moreMedicationId(g) : undefined;
        case "todo":
          return undefined;
      }
    },
  }));

/** Every seed group's tags, with how to find their records. */
export const tagGroups = (): TagGroup[] => [
  devLike(DEV_GROUP_ID, devEntryId, DEV_FAMILY_TAGS),
  devLike(SECOND_GROUP_ID, secondEntryId, SECOND_GROUP_TAGS),
  ...moreGroups(),
  tedderGroup(),
];

/** The seeded tags and links as rows, their author by email. */
export const seedRows = () => {
  const groups = tagGroups();
  const tags = groups.flatMap(({ groupId, author, tags }) =>
    tags.map(({ name, color }) => ({
      id: tagId(groupId, name),
      groupId,
      name: tagName(name),
      nameKey: tagKey(name),
      color,
      author,
    })),
  );
  const links = groups.flatMap(({ groupId, author, tags, idOf }) =>
    tags.flatMap(({ name, on }) =>
      on.map((record) => {
        const recordId = idOf(record);
        if (!recordId) throw new Error(`Seed tags name a missing ${record.target}: ${record.key}`);
        const tag = tagId(groupId, name);
        return {
          id: recordTagId(tag, recordId),
          groupId,
          tagId: tag,
          ...({ [TAG_TARGET_FIELDS[record.target]]: recordId } as TagTargetIds),
          author,
        };
      }),
    ),
  );
  return { tags, links };
};

export const seed = async () => {
  const db = getDb();
  const { tags, links } = seedRows();
  const emails = [...new Set(tags.map((t) => t.author))];
  const users = await db
    .select({ id: userSchema.id, email: userSchema.email })
    .from(userSchema)
    .where(inArray(userSchema.email, emails));
  const idOf = new Map(users.map((u) => [u.email, u.id]));
  // A group whose author isn't seeded is skipped.
  const audited = <T extends { author: string }>({ author, ...row }: T) => {
    const id = idOf.get(author);
    return id ? [{ ...row, createdBy: id, updatedBy: id }] : [];
  };
  const tagRows = tags.flatMap(audited);
  const linkRows = links.flatMap(audited);
  if (tagRows.length)
    await db.insert(tagSchema).values(tagRows).onConflictDoNothing({ target: tagSchema.id });
  if (linkRows.length)
    await db.insert(recordTagSchema).values(linkRows).onConflictDoNothing({ target: recordTagSchema.id });
};
