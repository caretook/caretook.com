import type { Editor } from "@tiptap/react";
import type { BindNoteDocOptions, NoteDocParts } from "~/lib/sync/notes";

import { NOTE_FRAGMENT } from "@caretook/data/schema";
import Collaboration from "@tiptap/extension-collaboration";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Bold, Heading2, Italic, List, ListOrdered } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { bindNoteDoc, createNoteDoc } from "~/lib/sync/notes";

/**
 * A live document: a Tiptap editor on a Y.Doc that's kept in step with the
 * local database (see lib/sync/notes.ts). Writers edit; viewers watch the
 * same document update, read-only. Remount it (`key`) for another document.
 */
export function LiveNotesEditor({
  label,
  initial,
  autofocus = false,
  ...options
}: BindNoteDocOptions & {
  label: string;
  initial: NoteDocParts;
  /** Put the cursor in the document on open (a writer starting a new entry). */
  autofocus?: boolean;
}) {
  const { db, documentId, groupId, canWrite, ensureSaved } = options;
  // One Y.Doc for the component's lifetime, holding what the loader read,
  // so the editor opens with the text instead of filling in afterwards.
  const [doc] = useState(() => createNoteDoc(initial));

  // Bind it to the database while mounted. Unbinding writes the last
  // keystrokes, and so does leaving the page. `ensureSaved` must be stable.
  useEffect(() => {
    const binding = bindNoteDoc(doc, { db, documentId, groupId, canWrite, ensureSaved });
    const onHide = () => void binding.flush();
    window.addEventListener("pagehide", onHide);
    return () => {
      window.removeEventListener("pagehide", onHide);
      binding.unbind();
    };
  }, [doc, db, documentId, groupId, canWrite, ensureSaved]);

  // The role is live (`useGroup()`), so editing follows it without a remount:
  // a writer made a viewer can't type on, and back. The attributes read it
  // through a ref, because ProseMirror re-reads them on each update.
  const canWriteRef = useRef(canWrite);

  const editor = useEditor({
    // Rendered in the browser only (the /app shell has no server data).
    immediatelyRender: false,
    editable: canWrite,
    autofocus: canWrite && autofocus ? "end" : false,
    extensions: [
      // Collaboration brings its own undo (Yjs-aware): StarterKit's must be off.
      StarterKit.configure({ undoRedo: false, link: false }),
      Collaboration.configure({ document: doc, field: NOTE_FRAGMENT }),
    ],
    editorProps: {
      attributes: () => ({
        "aria-label": label,
        "aria-multiline": "true",
        role: "textbox",
        ...(canWriteRef.current ? {} : { "aria-readonly": "true" }),
        class: "live-notes min-h-[50vh] px-4 py-3 outline-none",
      }),
    },
  });

  useEffect(() => {
    canWriteRef.current = canWrite;
    if (editor && editor.isEditable !== canWrite) editor.setEditable(canWrite);
  }, [editor, canWrite]);

  return (
    <div className="rounded-box border-base-300 bg-base-100 border">
      {canWrite && editor && <Toolbar editor={editor} />}
      <EditorContent editor={editor} />
    </div>
  );
}

/** Formatting buttons. Kept small: these are working notes, not documents. */
function Toolbar({ editor }: { editor: Editor }) {
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      heading: e.isActive("heading", { level: 2 }),
      bulletList: e.isActive("bulletList"),
      orderedList: e.isActive("orderedList"),
    }),
  });

  const buttons = [
    { key: "bold", label: "Bold", Icon: Bold, run: () => editor.chain().focus().toggleBold().run() },
    { key: "italic", label: "Italic", Icon: Italic, run: () => editor.chain().focus().toggleItalic().run() },
    {
      key: "heading",
      label: "Heading",
      Icon: Heading2,
      run: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
    },
    {
      key: "bulletList",
      label: "Bulleted list",
      Icon: List,
      run: () => editor.chain().focus().toggleBulletList().run(),
    },
    {
      key: "orderedList",
      label: "Numbered list",
      Icon: ListOrdered,
      run: () => editor.chain().focus().toggleOrderedList().run(),
    },
  ] as const;

  return (
    <div
      role="toolbar"
      aria-label="Formatting"
      className="border-base-300 bg-base-100/95 sticky top-0 z-10 flex gap-1 rounded-t-box border-b p-1 backdrop-blur"
    >
      {buttons.map(({ key, label, Icon, run }) => (
        <button
          key={key}
          type="button"
          aria-label={label}
          aria-pressed={state[key]}
          // Keep the editor's selection: a toolbar tap shouldn't blur it.
          onMouseDown={(e) => e.preventDefault()}
          onClick={run}
          className={`btn btn-ghost btn-sm btn-square ${state[key] ? "btn-active" : ""}`}
        >
          <Icon className="size-4" aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}
