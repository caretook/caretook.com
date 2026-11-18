// Sharing an entry's link. No React or DOM globals here: the caller passes
// the browser's `navigator` (or a fake, in web:unit tests).
//
// A link grants no access: a signed-out member signs in and lands on the
// entry; anyone outside the group gets "Not found".

/** The web URL of a path. Native apps use the web origin (`VITE_API_ORIGIN`), not `capacitor://`. */
export const shareUrl = (origin: string, path: string) => new URL(path, origin).href;

/** The parts of `navigator` that sharing uses. */
export type ShareNavigator = {
  share?: (data: { title?: string; url?: string }) => Promise<void>;
  canShare?: (data: { title?: string; url?: string }) => boolean;
  clipboard?: { writeText: (text: string) => Promise<void> };
};

/**
 * - `shared`: the share sheet took it.
 * - `cancelled`: the share sheet was dismissed (say nothing).
 * - `copied`: no share sheet, so the link was copied.
 * - `failed`: neither worked; show the link so it can be copied by hand.
 */
export type ShareOutcome = "shared" | "cancelled" | "copied" | "failed";

/** The share sheet where there is one, otherwise the clipboard. */
export async function shareLink(
  nav: ShareNavigator,
  data: { title: string; url: string },
): Promise<ShareOutcome> {
  if (nav.share && (nav.canShare?.(data) ?? true)) {
    try {
      await nav.share(data);
      return "shared";
    } catch (e) {
      // Dismissing the sheet is an AbortError. Anything else (NotAllowedError
      // without a user gesture, say) falls through to the clipboard.
      if (e instanceof Error && e.name === "AbortError") return "cancelled";
    }
  }
  try {
    if (!nav.clipboard) return "failed";
    await nav.clipboard.writeText(data.url);
    return "copied";
  } catch {
    return "failed";
  }
}
