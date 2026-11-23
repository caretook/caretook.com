import type { ReactNodeViewProps } from "@tiptap/react";

import { NodeViewWrapper } from "@tiptap/react";
import { createContext, useContext } from "react";
import { Link } from "react-router";
import { appUrls } from "~/lib/app-shell/appUrls";

/** What a mention chip needs to know about the provider it names. */
export type MentionTarget = { name: string; deletedAt: string | null };

/**
 * The editor's providers by id, for its mention chips (current names, deleted
 * or not), and whether the chips link to their pages.
 */
export const MentionTargets = createContext<{
  groupId: string;
  providers: ReadonlyMap<string, MentionTarget>;
  links: boolean;
}>({ groupId: "", providers: new Map(), links: true });

/**
 * A mention in a live document: the provider's current name from the local
 * database (else the name it was typed with), as a link to their page (as
 * text when the editor's `links` is off). A provider this device doesn't
 * have, or a deleted one, is greyed text.
 */
export function MentionChip({ node }: ReactNodeViewProps) {
  const { groupId, providers, links } = useContext(MentionTargets);
  const id = typeof node.attrs.id === "string" ? node.attrs.id : null;
  const label = typeof node.attrs.label === "string" ? node.attrs.label : "";
  const provider = id ? providers.get(id) : undefined;
  const name = provider?.name ?? label;

  return (
    <NodeViewWrapper as="span" data-mention={id ?? ""} contentEditable={false}>
      {id && provider && !provider.deletedAt && !links ? (
        <span className="bg-primary/10 rounded px-1 font-medium">{name}</span>
      ) : id && provider && !provider.deletedAt ? (
        <Link
          to={appUrls.provider(groupId, id)}
          className="bg-primary/10 decoration-primary/60 rounded px-1 font-medium underline underline-offset-2"
        >
          {name}
        </Link>
      ) : (
        <span className="bg-base-200 text-faint rounded px-1">{name}</span>
      )}
    </NodeViewWrapper>
  );
}
