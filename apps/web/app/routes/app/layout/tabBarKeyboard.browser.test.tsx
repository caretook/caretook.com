import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import { createRoutesStub, useLocation } from "react-router";
import { TEST_GROUP } from "../../../../test/fixtures";
import { useKeyboardOpen } from "~/lib/app-shell/keyboard";
import { TabBar } from "./SectionNav";

// B-664: the phone tab bar hides while the on-screen keyboard is open. The
// keyboard is simulated: a coarse pointer (`matchMedia`) and a stand-in
// `visualViewport` whose height the test shrinks and restores.

const G = TEST_GROUP.id;
const TIMELINE = `/app/groups/${G}/timeline`;
const FULL = 900;

class FakeViewport extends EventTarget {
  height = FULL;
  scale = 1;
  resize(height: number) {
    this.height = height;
    this.dispatchEvent(new Event("resize"));
  }
}

let viewport: FakeViewport;
let restore: () => void;

/** A phone: a coarse pointer, and `viewport` standing in for `window.visualViewport`. */
function fakePhone({ coarse = true, withViewport = true } = {}) {
  const media = window.matchMedia.bind(window);
  const matchSpy = vi
    .spyOn(window, "matchMedia")
    .mockImplementation((q) => (q.includes("pointer: coarse") ? { ...media(q), matches: coarse } : media(q)));
  viewport = new FakeViewport();
  const own = Object.getOwnPropertyDescriptor(window, "visualViewport");
  Object.defineProperty(window, "visualViewport", {
    configurable: true,
    get: () => (withViewport ? viewport : null),
  });
  restore = () => {
    matchSpy.mockRestore();
    if (own) Object.defineProperty(window, "visualViewport", own);
    else delete (window as { visualViewport?: unknown }).visualViewport;
  };
}

beforeEach(async () => {
  await page.viewport(420, FULL);
});

afterEach(() => restore());

function Probe() {
  const open = useKeyboardOpen();
  return (
    <>
      <input aria-label="Note" />
      <input type="checkbox" aria-label="Done" />
      <button type="button">Elsewhere</button>
      <output data-keyboard>{open ? "open" : "closed"}</output>
    </>
  );
}

const keyboard = () => document.querySelector("[data-keyboard]")?.textContent;

describe("useKeyboardOpen", () => {
  test("open for a focused text field with a shrunk viewport; closed after blur or when the viewport restores", async () => {
    fakePhone();
    await render(<Probe />);
    expect(keyboard()).toBe("closed");

    await userEvent.click(page.getByRole("textbox", { name: "Note" }));
    // Focus alone, before the keyboard has shrunk the viewport, isn't enough.
    expect(keyboard()).toBe("closed");
    viewport.resize(450);
    await expect.poll(keyboard).toBe("open");

    // The keyboard dismissed with the field still focused.
    viewport.resize(FULL);
    await expect.poll(keyboard).toBe("closed");

    viewport.resize(450);
    await expect.poll(keyboard).toBe("open");
    await userEvent.click(page.getByRole("button", { name: "Elsewhere" }));
    await expect.poll(keyboard).toBe("closed");
  });

  test("a checkbox never counts (a fine pointer is keyboard.test.ts)", async () => {
    fakePhone();
    await render(<Probe />);
    viewport.resize(450);
    await userEvent.click(page.getByRole("checkbox", { name: "Done" }));
    // The same viewport with a text field focused opens it, so the hook was listening.
    await userEvent.click(page.getByRole("textbox", { name: "Note" }));
    await expect.poll(keyboard).toBe("open");
    await userEvent.click(page.getByRole("checkbox", { name: "Done" }));
    await expect.poll(keyboard).toBe("closed");
  });

  test("without visualViewport, a focused text field on a coarse pointer is enough", async () => {
    fakePhone({ withViewport: false });
    await render(<Probe />);
    await userEvent.click(page.getByRole("textbox", { name: "Note" }));
    await expect.poll(keyboard).toBe("open");
    await userEvent.click(page.getByRole("button", { name: "Elsewhere" }));
    await expect.poll(keyboard).toBe("closed");
  });
});

function Frame() {
  const { pathname } = useLocation();
  return (
    <>
      <input aria-label="Note" />
      <button type="button">Elsewhere</button>
      <TabBar groupId={G} pathname={pathname} />
    </>
  );
}

const bar = () => document.querySelector<HTMLElement>("nav[data-tab-bar]");

describe("the tab bar", () => {
  test("hides off-screen, inert and aria-hidden, while the keyboard is open, and comes back after", async () => {
    fakePhone();
    const Stub = createRoutesStub([{ path: "/app/groups/:groupId/timeline", Component: Frame }]);
    await render(<Stub initialEntries={[TIMELINE]} />);
    await expect.element(page.getByRole("navigation", { name: "Group sections" })).toBeVisible();
    expect(bar()?.inert).toBe(false);

    await userEvent.click(page.getByRole("textbox", { name: "Note" }));
    viewport.resize(450);
    await expect.poll(() => bar()?.hasAttribute("data-keyboard-open")).toBe(true);
    expect(bar()?.inert).toBe(true);
    expect(bar()?.getAttribute("aria-hidden")).toBe("true");
    expect(page.getByRole("navigation", { name: "Group sections" }).query()).toBeNull();
    // Slid below the bottom of the window.
    await expect.poll(() => bar()?.getBoundingClientRect().top).toBeGreaterThanOrEqual(window.innerHeight);

    await userEvent.click(page.getByRole("button", { name: "Elsewhere" }));
    await expect.poll(() => bar()?.hasAttribute("data-keyboard-open")).toBe(false);
    expect(bar()?.inert).toBe(false);
    expect(bar()?.hasAttribute("aria-hidden")).toBe(false);
    await expect.poll(() => bar()?.getBoundingClientRect().bottom).toBeLessThanOrEqual(window.innerHeight);
    await expect.element(page.getByRole("navigation", { name: "Group sections" })).toBeVisible();
  });
});
