import type { Editor, Range } from "@tiptap/core";
import type { MentionOptions } from "@tiptap/extension-mention";
import type { SuggestionProps } from "@tiptap/suggestion";
import type { OtherGroupProviders } from "~/lib/providers/fromGroups";
import type { ImportSource } from "~/lib/providers/providerImport";
import type { MentionChoice, MentionFromGroup, MentionProvider } from "~/lib/providers/mentionOptions";

import Mention from "@tiptap/extension-mention";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { mentionChoices, mentionQueryOpen } from "~/lib/providers/mentionOptions";
import { MentionChip } from "./MentionChip";

type MentionAttrs = { id: string; label: string };

const NO_OTHERS: readonly OtherGroupProviders[] = [];
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
  /** The editor, and where the `@` text is: for an insert that lands later (`insertLater`). */
  editor: Editor;
  range: Range;
};

/**
 * Follows an `@` text (`range`) through the edits after a pick, local and
 * other devices' (Tiptap's mappable positions, which read Yjs's relative
 * ones under Collaboration), so a pick that's written later (an add or an
 * import) lands on that `@` and nowhere else. The returned function inserts
 * the mention over it, as Mention's command does, if the text is still
 * there; if it's gone (deleted or retyped), it inserts nothing. Either way
 * it stops following.
 */
const insertLater = (editor: Editor, range: Range) => {
  const text = editor.state.doc.textBetween(range.from, range.to);
  let at = editor.utils.createMappablePosition(range.from);
  const follow = ({ transaction }: { transaction: Parameters<Editor["utils"]["getUpdatedPosition"]>[1] }) => {
    at = editor.utils.getUpdatedPosition(at, transaction).position;
  };
  editor.on("transaction", follow);
  return (attrs: MentionAttrs | null) => {
    editor.off("transaction", follow);
    if (!attrs || editor.isDestroyed) return;
    const { doc, schema } = editor.state;
    const from = at.position;
    const to = from + text.length;
    if (to > doc.content.size || doc.textBetween(from, to) !== text) return;
    const type = schema.nodes[ProviderMention.name];
    if (!type) return;
    // A space after the `@` text is reused (Mention's rule). The caret maps through, so it stays where it was.
    const end = to < doc.content.size && doc.textBetween(to, to + 1) === " " ? to + 1 : to;
    const tr = editor.state.tr.replaceWith(from, end, [
      type.create({ ...attrs, mentionSuggestionChar: "@" }),
      schema.text(" "),
    ]);
    editor.view.dispatch(tr);
  };
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
 * inserts the new provider's mention once it's written, over the `@` text
 * that started it (none if that text is gone; the provider stays). `onAdd`
 * does any linking, so `onMention` isn't called; a refusal is `error`. With
 * `others` (the user's other groups' providers) and `onImport`, typed text
 * also lists "From <group>" sections; a pick there runs `onImport` (which
 * copies the provider here, and does any linking) and inserts the copy's
 * mention, as the add row does. The editor reads the options once; what
 * they read changes through refs.
 */
export function useMentionPopup({
  providers,
  enabled,
  onMention,
  onAdd,
  others = NO_OTHERS,
  onImport,
}: {
  providers: readonly MentionProvider[];
  enabled: boolean;
  onMention?: (providerId: string) => void;
  /** Adds the typed name as a provider (no add row without it). */
  onAdd?: (name: string) => Promise<MentionAddResult>;
  /** The user's other groups' providers, for the "From <group>" sections. */
  others?: readonly OtherGroupProviders[];
  /** Copies another group's provider (`choice.id`, one of `source`, its group's) here. No sections without it. */
  onImport?: (choice: MentionFromGroup, source: readonly ImportSource[]) => Promise<MentionAddResult>;
}) {
  const id = useId();
  const [open, setOpen] = useState<Open | null>(null);
  const [active, setActive] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const canAdd = !!onAdd;
  const sources = onImport ? others : NO_OTHERS;
  const options = useMemo(
    () => (open ? mentionChoices(providers, open.query, { canAdd, others: sources }) : null),
    [open, providers, canAdd, sources],
  );

  // What the ProseMirror plugin reads when it runs (outside React's render).
  const enabledRef = useRef(enabled);
  const providersRef = useRef(providers);
  const sourcesRef = useRef(sources);
  const onMentionRef = useRef(onMention);
  const onAddRef = useRef(onAdd);
  const onImportRef = useRef(onImport);
  const live = useRef({ open, options, active });
  useEffect(() => {
    enabledRef.current = enabled;
    providersRef.current = providers;
    sourcesRef.current = sources;
    onMentionRef.current = onMention;
    onAddRef.current = onAdd;
    onImportRef.current = onImport;
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
    const copy = onImportRef.current;
    const source = (o: MentionFromGroup) =>
      sourcesRef.current.find((g) => g.id === o.groupId)?.providers ?? [];
    const write =
      option.kind === "add" ? add && (() => add(option.name)) : copy && (() => copy(option, source(option)));
    if (!write || adding.current) return;
    const label = option.kind === "add" ? option.name : option.label;
    adding.current = true;
    // Insert at the `@` that started it, wherever edits since have moved it (never another popup's).
    const insert = insertLater(current.editor, current.range);
    void write()
      .then(
        (res) => {
          setError(res.ok ? null : res.error);
          insert(res.ok ? { id: res.id, label } : null);
        },
        (err: unknown) => {
          insert(null);
          throw err;
        },
      )
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
    shouldShow: ({ query }) => mentionQueryOpen(providersRef.current, query, sourcesRef.current),
    floatingUi: { strategy: "fixed" },
    render: () => ({
      onStart: (props) => {
        setOpen({
          query: props.query,
          insert: props.command,
          mount: props.mount,
          editor: props.editor,
          range: props.range,
        });
        setActive(0);
      },
      // The first mount keeps following the caret (it reads the live decoration), so it stays.
      onUpdate: (props) => {
        setOpen((was) => ({
          query: props.query,
          insert: props.command,
          mount: was?.mount ?? props.mount,
          editor: props.editor,
          range: props.range,
        }));
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
