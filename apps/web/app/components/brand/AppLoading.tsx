import { LogoMark } from "./Logo";

/**
 * The app starting (B-806): the mark and "Loading…", centred, while the
 * first load waits on the session and the local database. It's root.tsx's
 * `HydrateFallback`, so the server's page and the native SPA's file show it
 * before any script runs: its look is plain classes on the theme tokens
 * (THEME_SCRIPT has set them by then), and app.css's `[data-app-loading]`
 * keeps it invisible for its first 300 ms (a quick start doesn't flicker)
 * and drops the spinner under reduced motion. It says nothing about being
 * offline; the frame's banner does once the app is up.
 */
export function AppLoading() {
  return (
    <main data-app-loading="" className="grid min-h-dvh place-items-center bg-base-200 p-6 text-base-content">
      <div role="status" aria-label="Loading…" className="flex flex-col items-center gap-4">
        <LogoMark className="size-16" />
        <p className="text-muted flex items-center gap-2">
          <span className="loading loading-spinner loading-sm" aria-hidden="true" />
          Loading…
        </p>
      </div>
    </main>
  );
}
