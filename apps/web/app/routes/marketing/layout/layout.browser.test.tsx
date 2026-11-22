import { describe, expect, test } from "vitest";
import { userEvent } from "vitest/browser";
import { openMarketing, SITE_URL } from "../marketingWorld";
import * as home from "../home/route";
import { MARKETING_LINKS } from "../site/pages";
import * as layout from "./route";

// The marketing frame on one device (moved down from marketing.spec.mjs): the
// landmarks, the skip link, the header at both widths, the phone menu and the
// calls to action, and home's head tags. What needs the built site (the theme
// before first paint, production CSS, no third-party request or app chunk,
// the scroll to the waitlist band) stays in the browser check; the meta
// builders are site/meta.test.ts's and the hero's links home/content.test.ts's.

const menuPanel = () => document.querySelector<HTMLElement>("[data-marketing-menu]");
const headerNav = () => document.querySelector("header nav");
const shown = (el: Element | null) => !!el && getComputedStyle(el).display !== "none";

describe("the marketing frame", () => {
  test("one h1 and the header, main and footer landmarks", async () => {
    const { screen } = await openMarketing("/");
    await expect.element(screen.getByRole("heading", { level: 1 })).toBeVisible();
    expect(document.querySelectorAll("h1")).toHaveLength(1);
    await expect.element(screen.getByRole("banner")).toBeVisible();
    await expect.element(screen.getByRole("main")).toBeInTheDocument();
    await expect.element(screen.getByRole("contentinfo")).toBeVisible();
  });

  test("the skip link is first, visible on focus, and moves focus to main", async () => {
    const { screen } = await openMarketing("/features");
    const skip = screen.getByRole("link", { name: "Skip to content" });
    await expect.element(skip).toHaveAttribute("href", "#main");
    await userEvent.keyboard("{Tab}");
    await expect.element(skip).toHaveFocus();
    const box = skip.element().getBoundingClientRect();
    expect(box.width).toBeGreaterThan(20);
    expect(box.height).toBeGreaterThan(10);
    expect(getComputedStyle(skip.element()).outlineStyle, "focus is visible").not.toBe("none");
    await userEvent.keyboard("{Enter}");
    await expect.element(screen.getByRole("main")).toHaveFocus();
  });

  test("at 420 the pages are behind a menu button, not in the header", async () => {
    const { screen } = await openMarketing("/", { width: 420 });
    await expect.element(screen.getByRole("button", { name: "Menu" })).toBeVisible();
    expect(shown(headerNav())).toBe(false);
  });

  test("at 1280 the header shows its links and no menu button", async () => {
    const { screen } = await openMarketing("/", { width: 1280 });
    await expect.element(screen.getByRole("banner").getByRole("link", { name: "FAQ" })).toBeVisible();
    expect(shown(headerNav())).toBe(true);
    expect(shown(document.querySelector('header button[aria-label="Menu"]'))).toBe(false);
  });

  test("the phone menu opens with Enter, traps nothing, and Escape closes it, returning focus", async () => {
    const { screen } = await openMarketing("/");
    const button = screen.getByRole("button", { name: "Menu" });
    await expect.element(button).toHaveAttribute("aria-expanded", "false");
    expect(menuPanel()?.hidden).toBe(true);
    await expect.element(button).toHaveAttribute("aria-controls", menuPanel()?.id ?? "");
    button.element().focus();
    await userEvent.keyboard("{Enter}");
    await expect.element(button).toHaveAttribute("aria-expanded", "true");
    expect(menuPanel()?.hidden).toBe(false);
    const links = [...(menuPanel()?.querySelectorAll("a") ?? [])].map((a) => [
      a.textContent?.trim(),
      a.getAttribute("href"),
    ]);
    expect(links).toEqual(
      expect.arrayContaining([
        ["Features", "/features"],
        ["FAQ", "/faq"],
        ["About", "/about"],
        ["Sign in", MARKETING_LINKS.signIn],
      ]),
    );
    await userEvent.keyboard("{Tab}");
    // Tab moves on: the menu traps nothing.
    await expect.element(button).not.toHaveFocus();
    await userEvent.keyboard("{Escape}");
    await expect.element(button).toHaveAttribute("aria-expanded", "false");
    expect(menuPanel()?.hidden).toBe(true);
    await expect.element(button).toHaveFocus();
  });

  test("choosing a link in the phone menu goes there and closes the menu", async () => {
    const device = await openMarketing("/");
    const button = device.screen.getByRole("button", { name: "Menu" });
    await userEvent.click(button);
    await expect.element(button).toHaveAttribute("aria-expanded", "true");
    // At 420 the header's own links are hidden, so the banner's FAQ is the menu's.
    await userEvent.click(device.screen.getByRole("banner").getByRole("link", { name: "FAQ" }));
    await expect.poll(() => device.location()).toBe("/faq");
    await expect.element(button).toHaveAttribute("aria-expanded", "false");
    expect(menuPanel()?.hidden).toBe(true);
  });

  test("Join the waitlist goes to home's band; Sign in (the header link at 1280) reaches /sign-in", async () => {
    const device = await openMarketing("/features", { width: 1280 });
    const banner = device.screen.getByRole("banner");
    await expect
      .element(banner.getByRole("link", { name: "Join the waitlist" }))
      .toHaveAttribute("href", MARKETING_LINKS.waitlist);
    await userEvent.click(banner.getByRole("link", { name: "Sign in" }).first());
    await expect.poll(() => device.location()).toBe(MARKETING_LINKS.signIn);
  });
});

describe("home's head", () => {
  test("its canonical URL is the site root, with the Organization JSON-LD; the layout links the manifest", () => {
    const tags = home.meta({ matches: [{ loaderData: { siteUrl: SITE_URL } }] } as never) as Record<
      string,
      unknown
    >[];
    expect(tags.find((t) => t.rel === "canonical")?.href).toBe(`${SITE_URL}/`);
    expect(tags.find((t) => t.property === "og:url")?.content).toBe(`${SITE_URL}/`);
    const ld = tags.flatMap((t) => ("script:ld+json" in t ? [t["script:ld+json"]] : []));
    expect(ld).toEqual([expect.objectContaining({ "@type": "Organization", name: "Caretook" })]);
    expect(layout.links()).toContainEqual({ rel: "manifest", href: "/site.webmanifest" });
  });
});
