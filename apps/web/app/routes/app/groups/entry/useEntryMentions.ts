import type { MentionAddResult } from "~/components/notes/useMentionPopup";
import type { MentionFromGroup } from "~/lib/providers/mentionOptions";
import type { ImportSource } from "~/lib/providers/providerImport";
import type { LocalProvider } from "~/lib/providers/providers.sync";

import { useState } from "react";
import { useMentionProviders } from "~/lib/providers/mentionProviders.sync";
import { getSync } from "~/lib/sync";
import { createAndLinkProvider, importAndLinkProvider, linkProvider } from "~/lib/providers/providers.sync";

const NOT_STORED = "Couldn't save this entry, so the provider wasn't linked.";

/**
 * The entry page's mentions: the group's providers for the editor (live,
 * deleted ones included so their chips grey), and what a mention does here:
 * it links the provider to the entry, as the With row does (a draft is saved
 * first; a provider already linked stays one link). The popup's add row
 * creates a clinician and links it in one step, and a "From <group>" pick
 * copies that provider here and links the copy in one step. Deleting a
 * mention changes no link. Returns data and callbacks only.
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
    void (async () => {
      if (!(await ensureStored())) return setError(NOT_STORED);
      const res = await linkProvider(getSync(), entryId, providerId);
      setError(res.ok ? null : res.error);
    })();

  const onAdd = async (name: string): Promise<MentionAddResult> => {
    if (!(await ensureStored())) return { ok: false, error: NOT_STORED };
    return createAndLinkProvider(getSync(), entryId, { type: "clinician", name });
  };

  const onImport = async (
    choice: MentionFromGroup,
    source: readonly ImportSource[],
  ): Promise<MentionAddResult> => {
    if (!(await ensureStored())) return { ok: false, error: NOT_STORED };
    return importAndLinkProvider(getSync(), entryId, source, choice.id);
  };

  return { providers, onMention, onAdd, onImport, error };
}
