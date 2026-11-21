import { TEST_GROUP, TEST_RECIPIENT } from "./fixtures";

/**
 * A section page's header as a person reads it (`ui/PageHeader`, timeline-ux-2):
 * its `h1`, and whether it names the recipient or the group or carries a
 * viewer note ("You can view…"). Pages name themselves, never the recipient.
 */
export function pageHeader() {
  const header = document.querySelector("main header");
  const text = header?.textContent ?? "";
  return {
    h1: header?.querySelector("h1")?.textContent?.trim() ?? null,
    namesRecipient: [TEST_RECIPIENT.preferredName, TEST_RECIPIENT.name, TEST_GROUP.name].some((name) =>
      text.includes(name),
    ),
    viewerNote: text.includes("You can view"),
  };
}
