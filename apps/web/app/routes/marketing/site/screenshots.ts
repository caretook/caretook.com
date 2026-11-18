/**
 * The app screenshots the marketing site shows, made from fictional seed data
 * by `scripts/browser-checks/marketing-screenshots.mjs` into
 * `public/screenshots/`. Each screen exists in light and dark, at 420 and 840
 * pixels wide (`<name>-<theme>-<width>.webp`). Pure: content modules and tests
 * import it.
 *
 * A new screen is a capture in the script plus an entry here; rerun the script
 * when the app's screens change.
 */
export const SCREENSHOT_DIR = "/screenshots";
export const SCREENSHOT_WIDTHS = [420, 840] as const;
export const SCREENSHOT_THEMES = ["light", "dark"] as const;
/** Every capture is a 420×840 phone viewport (CSS pixels). */
export const SCREENSHOT_SIZE = { width: 420, height: 840 } as const;

export const SCREENSHOTS = {
  "timeline-rows": "The timeline",
  "timeline-cards": "The timeline as cards",
  vitals: "Every latest vital",
  "live-now": "Someone writing a note",
  "live-note": "A note written together",
  members: "A care group's members",
} as const satisfies Record<string, string>;

export type ScreenshotName = keyof typeof SCREENSHOTS;
export type ScreenshotTheme = (typeof SCREENSHOT_THEMES)[number];

/** A screenshot as content modules name it: which screen, and what it shows. */
export type ScreenshotRef = {
  name: ScreenshotName;
  /** What the picture shows, for screen readers (not "screenshot of…"). */
  alt: string;
  /** A short visible caption. */
  caption?: string;
};

export function screenshotSrc(name: ScreenshotName, theme: ScreenshotTheme, width: number): string {
  return `${SCREENSHOT_DIR}/${name}-${theme}-${width}.webp`;
}

/** `srcset` for one theme: every width, with its `w` descriptor. */
export function screenshotSrcSet(name: ScreenshotName, theme: ScreenshotTheme): string {
  return SCREENSHOT_WIDTHS.map((w) => `${screenshotSrc(name, theme, w)} ${w}w`).join(", ");
}

/** Every file the site can reference (what the script must produce). */
export function screenshotFiles(): string[] {
  return (Object.keys(SCREENSHOTS) as ScreenshotName[]).flatMap((name) =>
    SCREENSHOT_THEMES.flatMap((theme) => SCREENSHOT_WIDTHS.map((w) => screenshotSrc(name, theme, w))),
  );
}
