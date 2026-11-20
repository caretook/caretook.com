import type { BrowserCommand } from "vitest/node";

// Commands a component test can run on the Playwright page around it (they
// run in Node, beside Chromium): what the page itself can't do.
//
//   import { commands } from "vitest/browser";
//   await commands.colorScheme("dark");

/** The device's `prefers-color-scheme` (what the System theme follows); null resets it. */
const colorScheme: BrowserCommand<[scheme: "light" | "dark" | null]> = async (ctx, scheme) => {
  if (ctx.provider.name !== "playwright") throw new Error("colorScheme needs the Playwright provider");
  await (ctx as unknown as { page: { emulateMedia(o: object): Promise<void> } }).page.emulateMedia({
    colorScheme: scheme,
  });
};

/** The page's media type: "print" lays it out as printing would (`@media print`); null resets it. */
const media: BrowserCommand<[type: "print" | "screen" | null]> = async (ctx, type) => {
  if (ctx.provider.name !== "playwright") throw new Error("media needs the Playwright provider");
  await (ctx as unknown as { page: { emulateMedia(o: object): Promise<void> } }).page.emulateMedia({
    media: type,
  });
};

export const deviceCommands = { colorScheme, media };

declare module "vitest/browser" {
  interface BrowserCommands {
    colorScheme: (scheme: "light" | "dark" | null) => Promise<void>;
    media: (type: "print" | "screen" | null) => Promise<void>;
  }
}
