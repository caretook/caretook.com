// React Router's default client entry, plus the service worker (B-144):
// registered on production web builds only, after the page has loaded, so it
// never competes with the first paint. The dev server would fight Vite's hot
// reload, and the native app ships its files: both conditions are constants
// at build, so dev and native builds drop the registration altogether.
// A failed chunk after a deploy reloads to where the person was going, once
// (lib/app-shell/staleChunk.ts, B-735); not on native, whose chunks ship inside.
import { startTransition, StrictMode } from "react";
import { hydrateRoot } from "react-dom/client";
import { HydratedRouter } from "react-router/dom";

import { registerServiceWorker } from "./lib/app-shell/serviceWorkerRegister";
import { watchStaleChunks } from "./lib/app-shell/staleChunk";

// Production only: the dev server reloads for its own reasons (a module that doesn't compile).
const instrumentations = import.meta.env.PROD ? watchStaleChunks(import.meta.env.BUILD_TARGET, window) : [];

startTransition(() => {
  hydrateRoot(
    document,
    <StrictMode>
      <HydratedRouter instrumentations={instrumentations} />
    </StrictMode>,
  );
});

if (import.meta.env.PROD && import.meta.env.BUILD_TARGET === "web" && "serviceWorker" in navigator) {
  const register = () =>
    registerServiceWorker(navigator.serviceWorker).catch((error: unknown) => {
      // No worker means no offline reload, nothing worse: say so, don't break the page.
      console.warn("Service worker registration failed", error);
    });
  if (document.readyState === "complete") void register();
  else window.addEventListener("load", () => void register(), { once: true });
}
