import type { MenuEntry } from "~/components/ui";
import type { LocalProvider } from "~/lib/providers/providers.sync";

import { Copy, Ellipsis, Pencil, Tag } from "lucide-react";
import { useState } from "react";
import { Button, Menu } from "~/components/ui";
import { appUrls } from "~/lib/app-shell/appUrls";
import { COPY_ACTION } from "~/lib/providers/importWording";
import { PROVIDER_SHEET_STATE } from "~/lib/providers/providerSheetLink";
import { CopyToGroup, useCopyTargets } from "./CopyToGroup";

/**
 * A writer's actions on a provider, the shape of every `DetailHeader`'s:
 * Edit (the directory's sheet, which comes back here) and ⋯ with Copy to
 * another group (when you write in another group) and Tags (when `onTags`
 * is given). With neither, no ⋯. `onCopied` gets the copy's status line.
 */
export function ProviderActions({
  provider,
  groupName,
  onCopied,
  onTags,
}: {
  provider: LocalProvider;
  /** This group as the import sheet names it (the person, else the group). */
  groupName: string;
  onCopied: (message: string) => void;
  /** Opens the tag picker; left out, there's no Tags. */
  onTags?: () => void;
}) {
  const targets = useCopyTargets(provider);
  const [copying, setCopying] = useState(false);
  const items: MenuEntry[] = [
    targets.length > 0 && { id: "copy", label: COPY_ACTION, icon: Copy, onAction: () => setCopying(true) },
    onTags && { id: "tags", label: "Tags", icon: Tag, onAction: onTags },
  ];

  return (
    <>
      <Button
        to={appUrls.editProvider(provider.groupId, provider.id)}
        // Closing the sheet goes back here.
        state={PROVIDER_SHEET_STATE}
        prefetch="render"
        variant="ghost"
        size="sm"
        icon={Pencil}
        data-edit-provider=""
      >
        Edit
      </Button>
      {items.some(Boolean) && (
        <Menu
          label={`Actions for ${provider.name}`}
          items={items}
          variant="ghost"
          size="sm"
          shape="square"
          className="shrink-0"
          data-provider-actions=""
        >
          <Ellipsis className="size-4" aria-hidden="true" />
        </Menu>
      )}
      {targets.length > 0 && (
        <CopyToGroup
          provider={provider}
          groupName={groupName}
          targets={targets}
          open={copying}
          onClose={() => setCopying(false)}
          onResult={onCopied}
        />
      )}
    </>
  );
}
