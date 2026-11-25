import { afterEach, describe, expect, test } from "vitest";
import { cdp, page } from "vitest/browser";
import { HydrateFallback } from "~/root";
import { renderInRouter, renderWithDevice } from "../../../../test/device";
import { found } from "../../../../test/found";
import { TEST_GROUP } from "../../../../test/fixtures";
import { PROBE } from "../../../../test/probe";

// The loading screen while the app starts (B-806): root.tsx's HydrateFallback
// (the only one) shows it while the /app layout waits on the session and the
// local database, instead of a blank page. It stays invisible for its first
// 300 ms, follows the theme, and has no spinner under reduced motion (emulated
// from this file, reset after each test).

/** Chrome DevTools, for media emulation (Vitest types the session loosely). */
const devtools = () => cdp() as unknown as { send: (method: string, params: object) => Promise<unknown> };

afterEach(async () => {
  await devtools().send("Emulation.setEmulatedMedia", { features: [] });
});

const status = () => page.getByRole("status", { name: "Loading…" });
const screen = () => found(() => document.querySelector<HTMLElement>("[data-app-loading]"));
const opacity = (el: Element) => getComputedStyle(el).opacity;

/** Its one animation, paused, so the test reads it at a moment of its own choosing. */
const pausedAt = (el: HTMLElement, ms: number) => {
  const [appear] = el.getAnimations();
  expect(appear).toBeDefined();
  appear!.pause();
  appear!.currentTime = ms;
  return appear!;
};

describe("the loading screen", () => {
  test("HydrateFallback renders the mark and Loading as a status", async () => {
    await renderInRouter(<HydrateFallback />);
    await expect.element(status()).toHaveTextContent("Loading…");
    const el = await screen();
    expect(el.querySelector("svg")).not.toBeNull();
    // A spinner in daisyUI's loading style, hidden from assistive tech.
    expect(el.querySelector(".loading.loading-spinner[aria-hidden='true']")).not.toBeNull();
  });

  test("nothing shows for the first 300 ms, then it fades in", async () => {
    await renderInRouter(<HydrateFallback />);
    const el = await screen();
    expect(getComputedStyle(el).animationDelay).toBe("0.3s");
    const appear = pausedAt(el, 0);
    expect(opacity(el)).toBe("0");
    appear.currentTime = 299;
    expect(opacity(el)).toBe("0");
    appear.play();
    await expect.poll(() => opacity(el)).toBe("1");
  });

  test("under reduced motion: no spinner, and it appears at once at 300 ms", async () => {
    await devtools().send("Emulation.setEmulatedMedia", {
      features: [{ name: "prefers-reduced-motion", value: "reduce" }],
    });
    await renderInRouter(<HydrateFallback />);
    const el = await screen();
    const spinner = el.querySelector(".loading");
    expect(spinner).not.toBeNull();
    expect(getComputedStyle(spinner as Element).display).toBe("none");
    expect(getComputedStyle(el).animationDuration).toBe("0s");
    const appear = pausedAt(el, 299);
    expect(opacity(el)).toBe("0");
    appear.currentTime = 300;
    expect(opacity(el)).toBe("1");
  });

  test("follows the theme: the page's own surface and text, light and dark", async () => {
    for (const theme of ["light", "dark"] as const) {
      const { screen: rendered } = await renderInRouter(<HydrateFallback />, { theme });
      const el = await screen();
      expect(getComputedStyle(el).backgroundColor).toBe(getComputedStyle(document.body).backgroundColor);
      expect(getComputedStyle(el).color).toBe(getComputedStyle(document.body).color);
      await rendered.unmount();
    }
  });

  test("the /app layout shows it while the database opens, then the page", async () => {
    let opened!: () => void;
    const until = new Promise<void>((resolve) => (opened = resolve));
    await renderWithDevice({
      route: PROBE,
      url: `/app/groups/${TEST_GROUP.id}/timeline`,
      frame: true,
      settle: false,
      starting: { until, fallback: HydrateFallback },
    });
    await expect.element(status()).toBeInTheDocument();
    expect(document.querySelector("body header")).toBeNull();

    opened();
    await expect.element(page.getByRole("heading", { name: "Probe" })).toBeVisible();
    expect(document.querySelector("body header")).not.toBeNull();
    expect(document.querySelector("[data-app-loading]")).toBeNull();
  });
});
