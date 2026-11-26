import type { MentionAddResult } from "~/components/notes/useMentionPopup";
import type { MentionFromGroup } from "~/lib/providers/mentionOptions";
import type { ImportSource } from "~/lib/providers/providerImport";
import type { LocalProvider } from "~/lib/providers/providers.sync";

import { useState } from "react";
import { useMentionProviders } from "~/lib/providers/mentionProviders.sync";
import { getSync } from "~/lib/sync";
import { createAndLinkProvider, importAndLinkProvider, linkProvider } from "~/lib/providers/providers.sync";

const NOT_STORED = "Couldn't save this entry, so the provider wasn't linked.";
const WRITE_FAILED = "Couldn't link the provider. Try again.";

type Failed = { ok: false; error: string };

/**
 * A link whose local write throws (the database closed under it at sign-out
 * or teardown, a disk error) is a failed result, logged, never a rejection
 * left unhandled (B-845): a mention's link runs on after the pick.
 */
async function caught<T extends { ok: boolean }>(write: () => Promise<T>): Promise<T | Failed> {
  try {
    return await write();
  } catch (e) {
    console.error("Couldn't link the provider", e);
    return { ok: false, error: WRITE_FAILED };
  }
}

/**
 * The entry page's mentions: the group's providers for the editor (live,
 * deleted ones included so their chips grey), and what a mention does here:
 * it links the provider to the entry, as the With row does (a draft is saved
 * first; a provider already linked stays one link). The popup's add row
 * creates a clinician and links it in one step, and a "From <group>" pick
 * copies that provider here and links the copy in one step. Deleting a
 * mention changes no link. A write that throws is reported as an error,
 * like a refusal. Returns data and callbacks only.
 */
export function useEntryMentions({
  groupId,
  entryId,
  ensureStored,
}: {
  groupId: string;
  entryId: string;
  /** Saves a draft; resolves true once the entry is stored. */
  ensureStored: () => Promise<boolean>;
}): {
  providers: readonly LocalProvider[];
  onMention: (providerId: string) => void;
  onAdd: (name: string) => Promise<MentionAddResult>;
  onImport: (choice: MentionFromGroup, source: readonly ImportSource[]) => Promise<MentionAddResult>;
  error: string | null;
} {
  const providers = useMentionProviders(groupId);
  const [error, setError] = useState<string | null>(null);

  const onMention = (providerId: string) =>
    void caught(async (): Promise<{ ok: true } | Failed> => {
      if (!(await ensureStored())) return { ok: false, error: NOT_STORED };
      return linkProvider(getSync(), entryId, providerId);
    }).then((res) => setError(res.ok ? null : res.error));

  const onAdd = (name: string): Promise<MentionAddResult> =>
    caught(async (): Promise<MentionAddResult> => {
      if (!(await ensureStored())) return { ok: false, error: NOT_STORED };
      return createAndLinkProvider(getSync(), entryId, { type: "clinician", name });
    });

  const onImport = (choice: MentionFromGroup, source: readonly ImportSource[]): Promise<MentionAddResult> =>
    caught(async (): Promise<MentionAddResult> => {
      if (!(await ensureStored())) return { ok: false, error: NOT_STORED };
      return importAndLinkProvider(getSync(), entryId, source, choice.id);
    });

  return { providers, onMention, onAdd, onImport, error };
}
