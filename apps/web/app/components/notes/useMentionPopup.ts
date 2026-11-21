import type { MentionOptions } from "@tiptap/extension-mention";
import type { SuggestionProps } from "@tiptap/suggestion";
import type { MentionChoice, MentionProvider } from "~/lib/providers/mentionOptions";

import Mention from "@tiptap/extension-mention";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { mentionChoices, mentionQueryOpen } from "~/lib/providers/mentionOptions";
import { MentionChip } from "./MentionChip";

type MentionAttrs = { id: string; label: string };
type MentionSuggestion = MentionOptions["suggestion"];

/** What adding a provider from the popup returns: the new provider's id, or why not. */
export type MentionAddResult = { ok: true; id: string } | { ok: false; error: string };

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
  /** Null while closed. The add row, for writers, comes last. */
  options: MentionChoice[] | null;
  /** The highlighted option's index. */
  active: number;
  /** Puts the popup element under the caret while it's open (the plugin keeps it there). */
  popupRef: (el: HTMLElement | null) => void;
  pick: (option: MentionChoice) => void;
  highlight: (index: number) => void;
};

/**
 * The `@` popup: the mention node's suggestion options and the popup's
 * state. The popup only opens while `enabled` (a writer, with the group's
 * providers given). A pick inserts the mention, then calls `onMention` with
 * the provider's id. The add row runs `onAdd` with the typed name and
 * inserts the new provider's mention once it's written (`onAdd` does any
 * linking, so `onMention` isn't called); a refusal is `error`. The editor
 * reads the options once; what they read changes through refs.
 */
export function useMentionPopup({
  providers,
  enabled,
  onMention,
  onAdd,
}: {
  providers: readonly MentionProvider[];
  enabled: boolean;
  onMention?: (providerId: string) => void;
  /** Adds the typed name as a provider (no add row without it). */
  onAdd?: (name: string) => Promise<MentionAddResult>;
}) {
  const id = useId();
  const [open, setOpen] = useState<Open | null>(null);
  const [active, setActive] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const canAdd = !!onAdd;
  const options = useMemo(
    () => (open ? mentionChoices(providers, open.query, { canAdd }) : null),
    [open, providers, canAdd],
  );

  // What the ProseMirror plugin reads when it runs (outside React's render).
  const enabledRef = useRef(enabled);
  const providersRef = useRef(providers);
  const onMentionRef = useRef(onMention);
  const onAddRef = useRef(onAdd);
  const live = useRef({ open, options, active });
  useEffect(() => {
    enabledRef.current = enabled;
    providersRef.current = providers;
    onMentionRef.current = onMention;
    onAddRef.current = onAdd;
    live.current = { open, options, active };
  });

  // One add at a time: a second Enter while the first writes does nothing.
  const adding = useRef(false);
  const pick = (option: MentionChoice) => {
    const current = live.current.open;
    if (!current) return;
    if (option.kind === "provider") {
      setError(null);
      current.insert({ id: option.id, label: option.label });
      onMentionRef.current?.(option.id);
      return;
    }
    const add = onAddRef.current;
    if (!add || adding.current) return;
    adding.current = true;
    void add(option.name)
      .then((res) => {
        setError(res.ok ? null : res.error);
        // Insert over the `@` text as it is now (the popup may have moved on), else where it was.
        if (res.ok) (live.current.open ?? current).insert({ id: res.id, label: option.name });
      })
      .finally(() => (adding.current = false));
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
    // Spaces allowed, so "Dr. Chen" can be typed whole; `mentionQueryOpen` ends it once it reads as text.
    allowSpaces: true,
    shouldShow: ({ query }) => mentionQueryOpen(providersRef.current, query),
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
  return { suggestion, popup: state, error };
}
