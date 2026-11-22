import { afterEach, describe, expect, test, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { waitingWorker, type WaitingWorker } from "~/lib/app-shell/serviceWorkerRegister";
import { renderWithDevice } from "../../../../test/device";
import { fx, TEST_GROUP } from "../../../../test/fixtures";
import { PROBE } from "../../../../test/probe";

// The update notice (the frame's `update` region): a new service worker has
// installed and waits; Reload asks it to take over (lib/app-shell/serviceWorker.ts).

const show = () =>
  renderWithDevice({
    route: PROBE,
    url: `/app/groups/${TEST_GROUP.id}/timeline`,
    frame: true,
    fixtures: [fx.note({ text: "Slept well" })],
  });

/** A waiting worker that records what the page posts to it (it never activates). */
const fakeWaiting = () =>
  Object.assign(new EventTarget(), {
    state: "installed",
    postMessage: vi.fn(),
  }) as unknown as WaitingWorker & {
    postMessage: ReturnType<typeof vi.fn>;
  };

afterEach(() => waitingWorker.set(null));

describe("the update notice", () => {
  test("is hidden while no new version waits", async () => {
    const device = await show();
    await expect.element(page.getByText("Slept well")).toBeVisible();
    expect(device.screen.container.querySelector('[data-region="update"]')?.childElementCount).toBe(0);
    expect(page.getByText("A new version is ready").query()).toBeNull();
  });

  test("shows when a new version is waiting, and Reload posts skip-waiting", async () => {
    await show();
    const worker = fakeWaiting();
    waitingWorker.set(worker);
    const notice = page.getByRole("status").filter({ hasText: "A new version is ready" });
    await expect.element(notice).toBeVisible();
    const reload = notice.getByRole("button", { name: "Reload" });
    await userEvent.click(reload);
    expect(worker.postMessage).toHaveBeenCalledWith("skip-waiting");
    // Waiting for the new version to take over: the button doesn't post twice.
    await expect.element(reload).toBeDisabled();
    expect(worker.postMessage).toHaveBeenCalledTimes(1);
  });

  test("shows on a worker that was already waiting when the frame mounted", async () => {
    waitingWorker.set(fakeWaiting());
    await show();
    await expect.element(page.getByText("A new version is ready")).toBeVisible();
  });
});
