/**
 * The app screenshots the marketing site shows. **For now each one is an SVG
 * placeholder** (`public/screenshots/<name>.svg`, a phone outline that says
 * "Screenshot coming soon" and follows the device's light or dark setting),
 * to keep the repo small until the app's screens settle. Real screenshots are
 * a backlog item before launch: `scripts/browser-checks/marketing-screenshots.mjs`
 * can capture them from seed data, and this module then points at them.
 *
 * Pure: content modules and tests import it.
 */
export const SCREENSHOT_DIR = "/screenshots";
/** Every screen is a 420×840 phone viewport (CSS pixels). */
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

/** A screenshot as content modules name it: which screen, and what it shows. */
export type ScreenshotRef = {
  name: ScreenshotName;
  /** What the picture shows, for screen readers (not "screenshot of…"). */
  alt: string;
  /** A short visible caption. */
  caption?: string;
};

export function screenshotSrc(name: ScreenshotName): string {
  return `${SCREENSHOT_DIR}/${name}.svg`;
}

/** Every file the site can reference. */
export function screenshotFiles(): string[] {
  return (Object.keys(SCREENSHOTS) as ScreenshotName[]).map((name) => screenshotSrc(name));
}
