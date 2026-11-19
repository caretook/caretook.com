import "~/app.css";

import { afterEach } from "vitest";
import { cleanup } from "vitest-browser-react";
import { closeDevices } from "./device";

// The page as root.tsx renders it: the body's classes and the document's language.
document.documentElement.lang = "en";
document.body.className = "min-h-dvh bg-base-200 text-base-content";

// Every component test (Vitest's `web:components` project) runs with the
// app's stylesheet (Tailwind and daisyUI), and starts from a clean page:
// the screen unmounts before its database closes, so no watch outlives it.
afterEach(async () => {
  await cleanup();
  await closeDevices();
});
