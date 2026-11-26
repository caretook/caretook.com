import { LoadingMark } from "./LoadingMark";

/**
 * The app starting (B-806): the mark and "Loading…", centred, while the
 * first load waits on the session and the local database. It's root.tsx's
 * `HydrateFallback`, so the server's page and the native SPA's file show it
 * before any script runs: its look is plain classes on the theme tokens
 * (THEME_SCRIPT has set them by then), and app.css's `[data-app-loading]`
 * keeps it invisible for its first 300 ms (a quick start doesn't flicker)
 * and drops the spinner under reduced motion. It says nothing about being
 * offline; the frame's banner does once the app is up. Its look is
 * `LoadingMark`, shared with the in-app `ui/PageLoading`.
 */
export function AppLoading() {
  return (
    <main data-app-loading="" className="grid min-h-dvh place-items-center bg-base-200 p-6 text-base-content">
      <LoadingMark message="Loading…" />
    </main>
  );
}
