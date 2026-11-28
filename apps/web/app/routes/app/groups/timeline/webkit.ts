/** The parts of `navigator` the check reads (so tests pass plain objects). */
export type EngineNav = Pick<Navigator, "userAgent"> & Partial<Pick<Navigator, "maxTouchPoints">>;

/**
 * Whether the page runs on WebKit: Safari, every iOS browser (Chrome, Firefox
 * and Edge on iOS are WebKit too) and the installed PWA on iOS. An iPad in
 * desktop mode says "Macintosh", so a Mac with more than one touch point
 * counts as an iPad. Chromium and Firefox say "AppleWebKit" too, so desktop
 * Safari is the one that names no other engine.
 *
 * Why (B-1046): on iOS Safari and the PWA, rows under `content-visibility:
 * auto` (`offscreenRows.ts`) could stay unpainted on screen until a scroll,
 * leaving the Today header with nothing below it.
 */
export function isWebKit(nav: EngineNav): boolean {
  const ua = nav.userAgent;
  if (/iPhone|iPad|iPod/.test(ua)) return true;
  if (/Macintosh/.test(ua) && (nav.maxTouchPoints ?? 0) > 1) return true;
  return /AppleWebKit/.test(ua) && !/Chrome|Chromium|Edg|OPR|Android|Firefox/.test(ua);
}

let onWebKitCache: boolean | undefined;

/** `isWebKit(navigator)`, asked once; false where there's no `navigator` (the server). */
export function onWebKit(): boolean {
  if (typeof navigator === "undefined") return false;
  return (onWebKitCache ??= isWebKit(navigator));
}
