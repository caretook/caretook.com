import type { ProviderPhone, ProviderStatus, ProviderType } from "../schema";

import { eq } from "drizzle-orm";
import { getDb } from "../client";
import {
  encodeNoteDoc,
  entryProviderId,
  noteDocFromText,
  noteDocumentSchema,
  noteText,
  providerSchema,
  timelineEntryProviderSchema,
  userSchema,
} from "../schema";
import { DEV_GROUP_ID } from "./careGroups";
import { entryId as secondGroupEntryId, SECOND_GROUP_ENTRIES, SECOND_GROUP_ID } from "./secondGroup";
import { entryId as devFamilyEntryId, SEED_ENTRIES } from "./timelineEntries";

// Fictional providers for both seeded groups, with a few shared notes and
// links to existing seeded events and notes. Everything here is made up:
// 555-01xx numbers, @example.com emails and .example websites.
//
// Their own ids (…3f1d2b8e… for Dev Family, …3f1d2b8f… for Dev Family 2),
// following list order: append only.

const AUTHOR_EMAIL = "member@example.com";

export type SeedProvider = {
  /** A key other seeds refer to (`practice`, `links`). */
  key: string;
  type: ProviderType;
  name: string;
  specialty?: string;
  practice?: string;
  phones?: ProviderPhone[];
  email?: string;
  address?: string;
  website?: string;
  status?: ProviderStatus;
  isPrimary?: boolean;
  /** Shared live notes about them (one paragraph per line). */
  notes?: string;
  /** Titles of the group's seeded events and notes they were with. */
  links?: string[];
};

const devFamilyProviderId = (index: number) =>
  `0b6f3c1e-5d1a-4c2e-9a77-3f1d2b8e${String(1001 + index).padStart(4, "0")}`;
const secondGroupProviderId = (index: number) =>
  `0b6f3c1e-5d1a-4c2e-9a77-3f1d2b8f${String(1001 + index).padStart(4, "0")}`;

/** Grandma Pat's providers (Dev Family). */
export const DEV_FAMILY_PROVIDERS: SeedProvider[] = [
  {
    key: "westside",
    type: "practice",
    name: "Westside Family Medicine",
    specialty: "Primary care",
    phones: [
      { label: "Front desk", number: "(555) 010-2200" },
      { label: "Fax", number: "(555) 010-2201" },
      { label: "Nurse line", number: "(555) 010-2210" },
    ],
    address: "1200 Westside Ave, Suite 300\nSpringfield, CA 90000",
    website: "westsidefamily.example",
    isPrimary: true,
    links: ["Primary care visit: Dr. Alvarez"],
    notes: [
      "Park on level 2 of the garage; the elevator is by the blue doors.",
      "Check in at the kiosk, then ask for Rosa at the front desk if anything is off.",
      "The patient portal logs out after 10 minutes. Write questions down first.",
    ].join("\n"),
  },
  {
    key: "alvarez",
    type: "clinician",
    name: "Dr. Elena Alvarez",
    specialty: "Internal medicine",
    practice: "westside",
    phones: [
      { label: "Office", number: "(555) 010-2200 x214" },
      { label: "After hours", number: "(555) 010-2299" },
    ],
    email: "e.alvarez@westsidefamily.example",
    isPrimary: true,
    notes: "Prefers questions sent through the portal two days before a visit.",
    links: ["Primary care visit: Dr. Alvarez", "Follow-up with Dr. Alvarez"],
  },
  {
    key: "patel",
    type: "clinician",
    name: "Dr. Samuel Patel",
    specialty: "Cardiology",
    phones: [{ label: "Office", number: "(555) 010-3300" }],
    address: "48 Harbor Heart Center\nSpringfield, CA 90000",
    website: "https://harborheart.example/patel",
    links: ["Pharmacy pickup"],
  },
  {
    key: "cornerstone",
    type: "pharmacy",
    name: "Cornerstone Pharmacy",
    phones: [
      { label: "Pharmacy", number: "(555) 010-4400" },
      { label: "Refills", number: "(555) 010-4401" },
    ],
    address: "310 Main St\nSpringfield, CA 90000",
    website: "cornerstonepharmacy.example",
    isPrimary: true,
    notes: "Refills are ready after 2pm. The drive-through closes at 7.",
    links: ["Pharmacy pickup", "Pharmacy refill mix-up"],
  },
  {
    key: "maria",
    type: "other",
    name: "Maria Reyes",
    specialty: "Home health aide",
    phones: [{ label: "Mobile", number: "+1 555 010 5500" }],
    email: "maria.reyes@example.com",
    links: [
      "Meet-and-greet with Maria (aide)",
      "Phone call with Maria about today",
      "Primary care visit: Dr. Alvarez",
    ],
  },
  {
    key: "whitford",
    type: "clinician",
    name: "Dr. Alan Whitford",
    specialty: "Orthopedics",
    phones: [{ label: "Office", number: "(555) 010-6600" }],
    status: "past",
  },
];

/** Grandpa Lou's one provider (Dev Family 2), so the groups' directories stay separate. */
export const SECOND_GROUP_PROVIDERS: SeedProvider[] = [
  {
    key: "lindqvist",
    type: "clinician",
    name: "Dr. Grace Lindqvist",
    specialty: "Audiology",
    phones: [{ label: "Office", number: "(555) 010-7700" }],
    isPrimary: true,
    links: ["Hearing aid fitting"],
  },
];

type SeedGroup = {
  groupId: string;
  providers: SeedProvider[];
  providerId: (index: number) => string;
  /** The group's seeded entries' titles (live ones) → their ids. */
  entryIds: Map<string, string>;
};

const titleIndex = (entries: { title?: string; deleted?: boolean }[], id: (index: number) => string) =>
  new Map(entries.flatMap((e, i) => (e.title && !e.deleted ? [[e.title, id(i)] as const] : [])).reverse());

export const SEED_GROUPS: SeedGroup[] = [
  {
    groupId: DEV_GROUP_ID,
    providers: DEV_FAMILY_PROVIDERS,
    providerId: devFamilyProviderId,
    entryIds: titleIndex(SEED_ENTRIES, devFamilyEntryId),
  },
  {
    groupId: SECOND_GROUP_ID,
    providers: SECOND_GROUP_PROVIDERS,
    providerId: secondGroupProviderId,
    entryIds: titleIndex(SECOND_GROUP_ENTRIES, secondGroupEntryId),
  },
];

/** A seed provider's columns, as `providerContentZSchema` would accept them. */
export const seedProviderContent = (provider: SeedProvider, practiceId: string | null) => ({
  type: provider.type,
  name: provider.name,
  specialty: provider.specialty ?? null,
  practiceId,
  phones: provider.phones ?? [],
  email: provider.email ?? null,
  address: provider.address ?? null,
  website: provider.website ?? null,
  status: provider.status ?? "current",
  isPrimary: provider.isPrimary ?? false,
});

/** Every group's providers as rows, links and documents, ids resolved. */
export const seedRows = () =>
  SEED_GROUPS.map(({ groupId, providers, providerId, entryIds }) => {
    const idByKey = new Map(providers.map((p, i) => [p.key, providerId(i)]));
    const rows = providers.map((p, i) => ({
      id: providerId(i),
      groupId,
      ...seedProviderContent(p, p.practice ? (idByKey.get(p.practice) ?? null) : null),
    }));
    const links = providers.flatMap((p, i) =>
      (p.links ?? []).map((title) => {
        const entryId = entryIds.get(title);
        if (!entryId) throw new Error(`Seed provider ${p.key} links to a missing entry: ${title}`);
        return { id: entryProviderId(entryId, providerId(i)), groupId, entryId, providerId: providerId(i) };
      }),
    );
    const notes = providers.flatMap((p, i) =>
      p.notes ? [{ id: providerId(i), groupId, text: p.notes }] : [],
    );
    return { rows, links, notes };
  });

export const seed = async () => {
  const db = getDb();
  const [author] = await db
    .select({ id: userSchema.id })
    .from(userSchema)
    .where(eq(userSchema.email, AUTHOR_EMAIL));
  if (!author) return;
  const audits = { createdBy: author.id, updatedBy: author.id };

  for (const { rows, links, notes } of seedRows()) {
    // Practices first: clinicians point at them.
    const ordered = [...rows].sort((a, b) => Number(!!a.practiceId) - Number(!!b.practiceId));
    for (const row of ordered) {
      await db
        .insert(providerSchema)
        .values({ ...row, ...audits })
        .onConflictDoNothing({ target: providerSchema.id });
    }
    for (const link of links) {
      await db
        .insert(timelineEntryProviderSchema)
        .values({ ...link, ...audits })
        .onConflictDoNothing({ target: timelineEntryProviderSchema.id });
    }
    // Shared notes: live documents owned by the provider, already compacted,
    // last edited a few days ago (so nobody shows as typing).
    const now = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    for (const note of notes) {
      const doc = noteDocFromText(note.text);
      await db
        .insert(noteDocumentSchema)
        .values({
          id: note.id,
          groupId: note.groupId,
          subject: "provider",
          providerId: note.id,
          snapshot: encodeNoteDoc(doc),
          text: noteText(doc),
          editors: { [author.id]: now },
          createdAt: now,
          updatedAt: now,
          ...audits,
        })
        .onConflictDoNothing({ target: noteDocumentSchema.id });
      doc.destroy();
    }
  }
};
