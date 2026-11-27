import { describe, expect, test } from "vitest";
import { page } from "vitest/browser";

import { renderInRouter } from "../../../test/device";
import { FirstSyncPending } from "./index";

// A new device's slow first sync (lib/sync/firstSync.ts) shows the frame's
// full-page loader (`ui/PageLoading`, B-908), keeping the hook the
// first-sync browser check watches.

describe("FirstSyncPending", () => {
  test("renders through the page loader, as a status", async () => {
    await renderInRouter(<FirstSyncPending />, { url: "/app" });
    await expect.element(page.getByRole("status")).toBeInTheDocument();
    const main = document.querySelector("main[data-first-sync-pending]");
    expect(main).not.toBeNull();
    expect(main?.hasAttribute("data-page-loading")).toBe(true);
    expect(main?.querySelector("svg")).not.toBeNull();
  });
});
