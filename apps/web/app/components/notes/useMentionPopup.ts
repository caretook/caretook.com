import type { MentionOptions } from "@tiptap/extension-mention";
import type { SuggestionProps } from "@tiptap/suggestion";
import type { MentionOption, MentionProvider } from "~/lib/providers/mentionOptions";

import Mention from "@tiptap/extension-mention";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { mentionOptions } from "~/lib/providers/mentionOptions";
import { MentionChip } from "./MentionChip";

type MentionAttrs = { id: string; label: string };
type MentionSuggestion = MentionOptions["suggestion"];

/**
 * The mention node (Tiptap's Mention, an inline atom with `id` and `label`),
 * drawn as a `MentionChip`. Configure it with `useMentionPopup`'s `suggestion`.
 */
export const ProviderMention = Mention.extend({
  addNodeView: () => ReactNodeViewRenderer(MentionChip, { as: "span" }),
});

/** An open `@` popup: what's typed after the `@`, and how to insert the pick. */
type Open = {
  query: string;
  insert: (attrs: MentionAttrs) => void;
  mount: SuggestionProps["mount"];
};

export type MentionPopupState = {
  /** The popup's element id (the listbox), for the editor's `aria-controls`. */
  id: string;
  /** Null while closed. */
  options: MentionOption[] | null;
  /** The highlighted option's index. */
  active: number;
  /** Puts the popup element under the caret while it's open (the plugin keeps it there). */
  popupRef: (el: HTMLElement | null) => void;
  pick: (option: MentionOption) => void;
  highlight: (index: number) => void;
};

/**
 * The `@` popup: the mention node's suggestion options and the popup's
 * state. The popup only opens while `enabled` (a writer, with the group's
 * providers given). A pick inserts the mention, then calls `onMention` with
 * the provider's id. The editor reads the options once; what they read
 * changes through refs.
 */
export function useMentionPopup({
  providers,
  enabled,
  onMention,
}: {
  providers: readonly MentionProvider[];
  enabled: boolean;
  onMention?: (providerId: string) => void;
}) {
  const id = useId();
  const [open, setOpen] = useState<Open | null>(null);
  const [active, setActive] = useState(0);
  const options = useMemo(() => (open ? mentionOptions(providers, open.query) : null), [open, providers]);

  // What the ProseMirror plugin reads when it runs (outside React's render).
  const enabledRef = useRef(enabled);
  const onMentionRef = useRef(onMention);
  const live = useRef({ open, options, active });
  useEffect(() => {
    enabledRef.current = enabled;
    onMentionRef.current = onMention;
    live.current = { open, options, active };
  });

  const pick = (option: MentionOption) => {
    const current = live.current.open;
    if (!current) return;
    current.insert({ id: option.id, label: option.label });
    onMentionRef.current?.(option.id);
  };
  const pickRef = useRef(pick);
  useEffect(() => {
    pickRef.current = pick;
  });

  // The `@` trigger's options, for the editor's mention node (read once, when the editor is made).
  const suggestion: MentionSuggestion = {
    char: "@",
    // Writers only, and only where an inline node fits (Mention's own rule).
    allow: ({ state, range }) => {
      if (!enabledRef.current) return false;
      const type = state.schema.nodes.mention;
      return !!type && !!state.doc.resolve(range.from).parent.type.contentMatch.matchType(type);
    },
    floatingUi: { strategy: "fixed" },
    render: () => ({
      onStart: (props) => {
        setOpen({ query: props.query, insert: props.command, mount: props.mount });
        setActive(0);
      },
      // The first mount keeps following the caret (it reads the live decoration), so it stays.
      onUpdate: (props) => {
        setOpen((was) => ({ query: props.query, insert: props.command, mount: was?.mount ?? props.mount }));
        if (props.query !== live.current.open?.query) setActive(0);
      },
      onExit: () => setOpen(null),
      onKeyDown: ({ event }) => {
        const { options: shown, active: at } = live.current;
        if (!shown) return false;
        const count = shown.length;
        if (event.key === "ArrowDown" && count) {
          setActive((at + 1) % count);
          return true;
        }
        if (event.key === "ArrowUp" && count) {
          setActive((at - 1 + count) % count);
          return true;
        }
        if (event.key === "Enter" && shown[at]) {
          pickRef.current(shown[at]);
          return true;
        }
        return false;
      },
    }),
  };

  // Once the popup is on screen, the plugin positions it under the caret until it closes.
  const [popup, setPopup] = useState<HTMLElement | null>(null);
  const mount = open?.mount;
  useEffect(() => {
    if (!popup || !mount) return;
    return mount(popup);
  }, [popup, mount]);

  const state: MentionPopupState = { id, options, active, popupRef: setPopup, pick, highlight: setActive };
  return { suggestion, popup: state };
}
