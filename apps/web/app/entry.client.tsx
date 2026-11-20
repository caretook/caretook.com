// React Router's default client entry, plus the service worker (B-144):
// registered on production web builds only, after the page has loaded, so it
// never competes with the first paint. The dev server would fight Vite's hot
// reload, and the native app ships its files: both conditions are constants
// at build, so dev and native builds drop the registration altogether.
import { startTransition, StrictMode } from "react";
import { hydrateRoot } from "react-dom/client";
import { HydratedRouter } from "react-router/dom";

import { registerServiceWorker } from "./lib/app-shell/serviceWorkerRegister";

startTransition(() => {
  hydrateRoot(
    document,
    <StrictMode>
      <HydratedRouter />
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
