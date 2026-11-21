import type { ImportResult } from "./providerImport";

// What importing providers from another group says, in one place (the
// import sheet, and later the provider page's copy and the pickers'
// sections). Pure; unit-tested in web:unit.

/** The list's action and the sheet's title. */
export const IMPORT_ACTION = "Import from another group";
export const IMPORT_TITLE = "Import providers";

/** A section of another group's providers (the pickers) or the sheet's list. */
export const fromGroupHeading = (groupName: string) => `From ${groupName}`;

/** A provider whose type and name are already in this group. */
export const ALREADY_HERE = "Already here";

/** What a copy leaves behind. */
export const notesStayIn = (groupName: string) => `Provider notes stay in ${groupName}.`;

/** The import button: how many are ticked. */
export const importButtonLabel = (count: number) => `Import ${count}`;

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * The status after an import: how many were added (and practices copied
 * along with clinicians), and how many were skipped as already here.
 */
export const importSummary = (results: readonly ImportResult[]) => {
  const added = results.filter((r) => r.status === "added");
  const skipped = results.length - added.length;
  const addedIds = new Set(added.map((r) => r.id));
  const practices = new Set(
    added
      .filter((r) => r.practice === "copied" && r.practiceId && !addedIds.has(r.practiceId))
      .map((r) => r.practiceId),
  ).size;
  const skippedText = skipped ? `${count(skipped, "was", "were")} already here.` : "";
  if (added.length === 0) return skipped ? `Nothing imported: ${skippedText}` : "Nothing imported.";
  const addedText = `Imported ${count(added.length, "provider", "providers")}${
    practices ? ` and ${count(practices, "practice", "practices")}` : ""
  }.`;
  return skipped ? `${addedText} ${skippedText}` : addedText;
};

/** The provider page's copy action and its dialog. */
export const COPY_ACTION = "Copy to another group";
export const copyTitle = (providerName: string) => `Copy ${providerName}`;
export const COPY_BUTTON = "Copy";

/** The status after copying one provider to a group. */
export const copiedTo = (groupName: string) => `Copied to ${groupName}.`;
export const alreadyIn = (groupName: string) => `Already in ${groupName}. Nothing was copied.`;
