import type { RecentEditor } from "@caretook/data/schema";

// The timeline's "being written now" signals (the Live now banner and the
// live dot), as pure functions over each document's recent editors (from
// `toRecentEditors`, so the viewer is already left out).

/** A note or event that other members are writing in now. */
export type LiveDocument = { id: string; title: string; editors: RecentEditor[] };

/** "Maria", "Maria and Sam", "Maria, Sam and Lee". */
export const listNames = (names: string[]) =>
  names.length <= 1 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;

const lastEdit = (doc: LiveDocument) => Date.parse(doc.editors[0]?.lastEditAt ?? "") || 0;

/** The documents with other recent editors, the most recently edited first. */
export const liveDocuments = (docs: LiveDocument[]): LiveDocument[] =>
  docs
    .filter((d) => d.editors.length > 0)
    .sort((a, b) => lastEdit(b) - lastEdit(a) || (a.id < b.id ? -1 : 1));

/** "Maria is writing", "Maria and Sam are writing". */
export const writingLabel = (names: string[]) =>
  `${listNames(names)} ${names.length === 1 ? "is" : "are"} writing`;

/** The live dot's screen-reader label: "Being written now by Maria". */
export const liveDotLabel = (names: string[]) => `Being written now by ${listNames(names)}`;

/** What the banner announces for a document, once: "Maria is writing: PT visit". */
export const announcementText = (doc: LiveDocument, nameOf: (userId: string) => string) =>
  `${writingLabel(doc.editors.map((e) => nameOf(e.userId)))}: ${doc.title}`;
