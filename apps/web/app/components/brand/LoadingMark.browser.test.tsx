import { afterEach, describe, expect, test } from "vitest";
import { page } from "vitest/browser";

import { renderInRouter } from "../../../test/device";
import { advanceStartup, resetStartup } from "~/lib/sync/startup";
import { AppLoading } from "./AppLoading";
import { LoadingMark } from "./index";

// The shared loading look (B-957): the step's words as a polite status, a
// detail that isn't announced, and a labelled progress bar only when given.

afterEach(resetStartup);

const bar = () => page.getByRole("progressbar", { name: "Starting Caretook" });

describe("LoadingMark", () => {
  test("shows the step's words as a status and a labelled progress bar", async () => {
    await renderInRouter(
      <LoadingMark
        message="Syncing your care groups…"
        detail="40%"
        progress={{ value: 60, label: "Starting Caretook" }}
      />,
    );
    const status = page.getByRole("status", { name: "Syncing your care groups…" });
    await expect.element(status).toHaveTextContent("Syncing your care groups…");
    // The live region holds the step only: a percentage isn't announced.
    await expect.element(status).not.toHaveTextContent("40%");
    const detail = document.querySelector("[data-loading-detail]");
    expect(detail?.textContent).toBe("40%");
    expect(detail?.getAttribute("aria-hidden")).toBe("true");
    await expect.element(bar()).toHaveAttribute("value", "60");
    await expect.element(bar()).toHaveAttribute("max", "100");
  });

  test("with no progress it shows the step only", async () => {
    await renderInRouter(<LoadingMark message="Getting the page…" />);
    await expect.element(page.getByRole("status", { name: "Getting the page…" })).toBeInTheDocument();
    expect(document.querySelector("progress")).toBeNull();
    expect(document.querySelector("[data-loading-detail]")).toBeNull();
  });

  test("the start-up screen follows the startup's steps, its bar only growing", async () => {
    await renderInRouter(<AppLoading />);
    await expect.element(page.getByRole("status", { name: "Opening Caretook…" })).toBeInTheDocument();
    const value = () => Number(document.querySelector("progress")?.getAttribute("value"));
    const first = value();
    advanceStartup("device");
    await expect.element(page.getByRole("status", { name: "Getting your notes ready…" })).toBeInTheDocument();
    expect(value()).toBeGreaterThan(first);
    advanceStartup("sync", 0.4);
    await expect.element(page.getByRole("status", { name: "Syncing your care groups…" })).toBeInTheDocument();
    await expect.poll(() => document.querySelector("[data-loading-detail]")?.textContent).toBe("40%");
    advanceStartup("screen");
    await expect.element(page.getByRole("status", { name: "Almost there…" })).toBeInTheDocument();
    expect(document.querySelector("[data-loading-detail]")).toBeNull();
  });
});
