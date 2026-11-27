import { afterEach, describe, expect, test } from "vitest";
import { page } from "vitest/browser";

import { renderInRouter, renderWithDevice } from "../../../test/device";
import { TEST_GROUP } from "../../../test/fixtures";
import { advanceStartup, resetStartup } from "~/lib/sync/startup";
import { FirstSyncPending } from "./index";

// A new device's slow first sync (lib/sync/firstSync.ts) shows the frame's
// full-page loader (`ui/PageLoading`, B-908) at the startup's sync step
// (B-957), keeping the hook the first-sync browser check watches; once the
// first sync is done it reruns the loaders.

afterEach(resetStartup);

const syncing = () => page.getByRole("status", { name: "Syncing your care groups…" });

describe("FirstSyncPending", () => {
  test("renders through the page loader, at the syncing step", async () => {
    await renderInRouter(<FirstSyncPending />, { url: "/app" });
    await expect.element(syncing()).toBeInTheDocument();
    const main = document.querySelector("main[data-first-sync-pending]");
    expect(main).not.toBeNull();
    expect(main?.hasAttribute("data-page-loading")).toBe(true);
    expect(main?.querySelector("svg")).not.toBeNull();
    await expect.element(page.getByRole("progressbar", { name: "Starting Caretook" })).toBeInTheDocument();
    // No download yet: the step only, no percentage.
    expect(document.querySelector("[data-loading-detail]")).toBeNull();
  });

  test("a first sync in progress shows its percentage, the bar moving with it", async () => {
    advanceStartup("sync", 0.4);
    await renderInRouter(<FirstSyncPending />, { url: "/app" });
    await expect.element(syncing()).toBeInTheDocument();
    await expect.poll(() => document.querySelector("[data-loading-detail]")?.textContent).toBe("40%");
    const value = () => Number(document.querySelector("progress")?.getAttribute("value"));
    const before = value();
    advanceStartup("sync", 0.8);
    await expect.poll(() => document.querySelector("[data-loading-detail]")?.textContent).toBe("80%");
    expect(value()).toBeGreaterThan(before);
  });

  test("once the first sync is done, it reruns the loaders", async () => {
    let loads = 0;
    await renderWithDevice({
      route: {
        path: "/app/groups/:groupId/*",
        module: {
          clientLoader: () => ++loads,
          default: () => <FirstSyncPending />,
        },
      },
      url: `/app/groups/${TEST_GROUP.id}/timeline`,
      firstSyncDone: true,
    });
    await expect.poll(() => loads).toBeGreaterThanOrEqual(2);
  });
});
