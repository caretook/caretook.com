import { Link, useLocation } from "react-router";
import { describe, expect, test, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import { renderInRouter } from "../../../test/device";
import { appUrls } from "~/lib/app-shell/appUrls";
import { PAGE_LOADING_SLOW_AFTER, PageLoading } from "./index";

// The full-page loader inside the /app frame (B-908): its message as a
// status, the "taking a while" prompt only past its threshold (fake timers),
// and Go back: a step back in history, or the groups list with none.

const MESSAGE = "Getting the test page…";
const status = () => page.getByRole("status", { name: MESSAGE });
const slowPrompt = () => document.querySelector("[data-page-loading-slow]");
const goBack = () => page.getByCss("[data-page-loading-back]");

/** Two frames: React has committed whatever a fired timer set. */
const frames = () =>
  new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

/** A page with a link to `/loading`, which shows the loader. */
function TwoPages() {
  const { pathname } = useLocation();
  if (pathname === "/loading") return <PageLoading message={MESSAGE} back />;
  return <Link to="/loading">Open the slow page</Link>;
}

describe("PageLoading", () => {
  test("shows the mark, a spinner and its message as a status, in a main", async () => {
    await renderInRouter(<PageLoading message={MESSAGE} />);
    await expect.element(status()).toHaveTextContent(MESSAGE);
    const main = document.querySelector("main[data-page-loading]");
    expect(main).not.toBeNull();
    expect(main?.querySelector("svg[aria-hidden='true']")).not.toBeNull();
    expect(main?.querySelector(".loading.loading-spinner[aria-hidden='true']")).not.toBeNull();
    // No Go back until asked for or slow.
    expect(document.querySelector("[data-page-loading-back]")).toBeNull();
  });

  test("the slow prompt and Go back appear only after the threshold", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    await renderInRouter(<PageLoading message={MESSAGE} />);
    await expect.element(status()).toBeInTheDocument();
    await vi.advanceTimersByTimeAsync(PAGE_LOADING_SLOW_AFTER - 1);
    await frames();
    expect(slowPrompt()).toBeNull();
    expect(document.querySelector("[data-page-loading-back]")).toBeNull();
    await vi.advanceTimersByTimeAsync(1);
    await expect.poll(slowPrompt).not.toBeNull();
    await expect.element(goBack()).toBeVisible();
  });

  test("a custom threshold, and none at all", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const { screen } = await renderInRouter(<PageLoading message={MESSAGE} slowAfter={2_000} />);
    await vi.advanceTimersByTimeAsync(2_000);
    await expect.poll(slowPrompt).not.toBeNull();
    await screen.unmount();
    await renderInRouter(<PageLoading message={MESSAGE} slowAfter={null} />);
    await vi.advanceTimersByTimeAsync(PAGE_LOADING_SLOW_AFTER * 10);
    await frames();
    expect(slowPrompt()).toBeNull();
  });

  test("Go back steps back in history when the app has some", async () => {
    const { location } = await renderInRouter(<TwoPages />, { url: "/start" });
    await userEvent.click(page.getByRole("link", { name: "Open the slow page" }));
    await expect.element(status()).toBeInTheDocument();
    expect(location()).toBe("/loading");
    await userEvent.click(goBack());
    await expect.poll(location).toBe("/start");
  });

  test("Go back opens the groups list when there's no history", async () => {
    const { location } = await renderInRouter(<PageLoading message={MESSAGE} back />, { url: "/loading" });
    await userEvent.click(goBack());
    await expect.poll(location).toBe(appUrls.groupList());
  });

  test("onBack replaces the default", async () => {
    const onBack = vi.fn();
    const { location } = await renderInRouter(<PageLoading message={MESSAGE} back onBack={onBack} />, {
      url: "/loading",
    });
    await userEvent.click(goBack());
    expect(onBack).toHaveBeenCalledOnce();
    expect(location()).toBe("/loading");
  });
});
