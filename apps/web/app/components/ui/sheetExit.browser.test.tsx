import type { ComponentType } from "react";
import type { DeviceRoute } from "../../../test/device";

import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { afterEach, describe, expect, test, vi } from "vitest";
import { cdp, page, userEvent } from "vitest/browser";

import { renderInRouter, renderWithDevice } from "../../../test/device";
import { TEST_GROUP } from "../../../test/fixtures";
import { found } from "../../../test/found";
import {
  MEDICATION_ROUTES,
  menuItem,
  MORNING,
  PASSES,
} from "../../routes/app/groups/medications/medicationWorld";
import {
  chip,
  openFilters,
  openTimeline,
  TIMELINE_URL,
} from "../../routes/app/groups/timeline/timelineWorld";
import * as newTodo from "../../routes/app/groups/todos/new/route";
import * as todosRoute from "../../routes/app/groups/todos/route";
import { Sheet } from "./index";
import { pickTime } from "../../../test/timeSelect";

// A sheet closes the way it opened (ui-kit-3 slice 6): a dismissal plays the
// exit and then tells the caller; a navigation that changes the path is held
// for the exit; a search-only change and reduced motion hold nothing.

const devtools = () => cdp() as unknown as { send: (method: string, params: object) => Promise<unknown> };
const reduceMotion = () =>
  devtools().send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-reduced-motion", value: "reduce" }],
  });
afterEach(async () => {
  await devtools().send("Emulation.setEmulatedMedia", { features: [] });
});

const MOTION_MS = 180;
const SLOW_MS = 240;
const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
const overlay = () => document.querySelector<HTMLElement>('[data-sheet="overlay"]');
const panel = () => document.querySelector<HTMLElement>('[data-sheet="panel"]');
const seconds = (list: string) => list.split(",").map((s) => parseFloat(s));
const longest = (el: Element) => {
  const style = getComputedStyle(el);
  return Math.max(...seconds(style.transitionDuration), ...seconds(style.animationDuration));
};

/** When the exit started (`data-closing`) and when the overlay left the DOM. */
function watchExit() {
  const seen: { exitAt?: number; removedAt?: number } = {};
  const observer = new MutationObserver(() => {
    if (seen.exitAt === undefined && overlay()?.hasAttribute("data-closing")) seen.exitAt = performance.now();
    if (seen.removedAt === undefined && !overlay()) {
      seen.removedAt = performance.now();
      observer.disconnect();
    }
  });
  observer.observe(document.body, { subtree: true, childList: true, attributes: true });
  return seen;
}

function DismissHarness({ onChange }: { onChange: (open: boolean, at: number) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Add symptom
      </button>
      <Sheet
        isOpen={open}
        onOpenChange={(next) => {
          onChange(next, performance.now());
          setOpen(next);
        }}
        title="New symptom"
      >
        <input aria-label="What" />
      </Sheet>
    </>
  );
}

/** A route sheet at `/sheet` over a page at `/`, closing by navigating. */
function RouteHarness({ onChange }: { onChange?: (open: boolean) => void }) {
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  return (
    <>
      <Link to="/sheet">Open the sheet</Link>
      <p data-where>{pathname + search}</p>
      {pathname === "/sheet" && (
        <Sheet
          isOpen
          onOpenChange={(open) => {
            onChange?.(open);
            if (!open) void navigate("/");
          }}
          title="Route sheet"
        >
          <Link to="/">Cancel</Link>
          <Link to="/sheet?kind=vital">Vitals</Link>
          <button type="button" data-back onClick={() => void navigate(-1)}>
            Back
          </button>
        </Sheet>
      )}
    </>
  );
}

/** The browser's Back, pressed from outside the sheet's focus scope. */
const pressBack = () => document.querySelector<HTMLElement>("[data-back]")?.click();

/** The routes with a Back control beside the screen: the stub's history has no browser button. */
function withBack(routes: DeviceRoute[]): DeviceRoute[] {
  return routes.map((route) => {
    const Screen = route.module.default as ComponentType<object>;
    function WithBack(props: object) {
      const navigate = useNavigate();
      return (
        <>
          <button type="button" hidden data-back onClick={() => void navigate(-1)} />
          <Screen {...props} />
        </>
      );
    }
    return { ...route, module: { ...route.module, default: WithBack } };
  });
}

const DISMISSALS = [
  { way: "Close", act: () => userEvent.click(page.getByRole("button", { name: "Close" })) },
  { way: "Escape", act: () => userEvent.keyboard("{Escape}") },
  // Beside the centred sheet, on the dimming.
  {
    way: "a tap outside",
    act: async () =>
      userEvent.click(page.elementLocator(await found(() => overlay())), { position: { x: 4, y: 4 } }),
  },
] as const;

describe.each(DISMISSALS)("dismissed by $way", ({ act }) => {
  test("plays the exit, then calls onOpenChange(false) once; focus returns to the opener", async () => {
    const onChange = vi.fn<(open: boolean, at: number) => void>();
    const { screen } = await renderInRouter(<DismissHarness onChange={onChange} />, { width: 800 });
    const opener = screen.getByRole("button", { name: "Add symptom" });
    await userEvent.click(opener);
    await expect.element(page.getByRole("dialog", { name: "New symptom" })).toBeVisible();
    await expect.poll(() => getComputedStyle(overlay()!).opacity).toBe("1");
    const exit = watchExit();
    await act();
    await expect.poll(() => exit.removedAt).toBeDefined();
    expect(onChange).toHaveBeenCalledOnce();
    expect(onChange.mock.calls[0]?.[0]).toBe(false);
    const waited = (onChange.mock.calls[0]?.[1] ?? NaN) - (exit.exitAt ?? NaN);
    expect(waited).toBeGreaterThanOrEqual(MOTION_MS - 20);
    expect(waited).toBeLessThanOrEqual(SLOW_MS + 100);
    await expect.poll(() => document.activeElement).toBe(opener.element());
  });

  test("with reduced motion it closes in the next frame, with no transition or animation", async () => {
    await reduceMotion();
    const onChange = vi.fn();
    const { screen } = await renderInRouter(<DismissHarness onChange={onChange} />, { width: 800 });
    await userEvent.click(screen.getByRole("button", { name: "Add symptom" }));
    await expect.element(page.getByRole("dialog", { name: "New symptom" })).toBeVisible();
    expect(longest(await found(() => overlay()))).toBe(0);
    expect(longest(await found(() => panel()))).toBe(0);
    await act();
    await nextFrame();
    expect(overlay()).toBeNull();
    expect(onChange).toHaveBeenCalledOnce();
  });
});

describe("closed by navigating", () => {
  const openRouteSheet = async (onChange?: (open: boolean) => void) => {
    const view = await renderInRouter(<RouteHarness onChange={onChange} />);
    await userEvent.click(view.screen.getByRole("link", { name: "Open the sheet" }));
    await expect.element(page.getByRole("dialog", { name: "Route sheet" })).toBeVisible();
    await expect.poll(() => getComputedStyle(overlay()!).opacity).toBe("1");
    return view;
  };

  test("a link that leaves is held for the exit, then lands; the caller isn't called", async () => {
    const onChange = vi.fn();
    const { location } = await openRouteSheet(onChange);
    const exit = watchExit();
    await userEvent.click(page.getByRole("link", { name: "Cancel" }));
    await expect.poll(location).toBe("/");
    await expect.poll(() => exit.removedAt).toBeDefined();
    expect((exit.removedAt ?? NaN) - (exit.exitAt ?? NaN)).toBeGreaterThanOrEqual(MOTION_MS - 20);
    expect(onChange).not.toHaveBeenCalled();
  });

  test("Back is held for the exit, then lands", async () => {
    const { location } = await openRouteSheet();
    const exit = watchExit();
    await userEvent.click(page.getByRole("button", { name: "Back" }));
    await expect.poll(location).toBe("/");
    await expect.poll(() => exit.removedAt).toBeDefined();
    expect((exit.removedAt ?? NaN) - (exit.exitAt ?? NaN)).toBeGreaterThanOrEqual(MOTION_MS - 20);
  });

  test("a search-only change isn't held, and the sheet stays open", async () => {
    const { location } = await openRouteSheet();
    await userEvent.click(page.getByRole("link", { name: "Vitals" }));
    await expect.poll(location).toBe("/sheet?kind=vital");
    expect(overlay()?.hasAttribute("data-closing")).toBe(false);
    await expect.element(page.getByRole("dialog", { name: "Route sheet" })).toBeVisible();
  });

  test("Escape, then Back during the exit: Back wins, the sheet is gone, the caller isn't called", async () => {
    const onChange = vi.fn();
    const { location } = await openRouteSheet(onChange);
    await userEvent.keyboard("{Escape}");
    await expect.poll(() => overlay()?.hasAttribute("data-closing")).toBe(true);
    pressBack();
    await expect.poll(location).toBe("/");
    await expect.poll(overlay).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });

  test("with reduced motion a navigation isn't held", async () => {
    await reduceMotion();
    const { location } = await openRouteSheet();
    expect(longest(await found(() => overlay()))).toBe(0);
    await userEvent.click(page.getByRole("link", { name: "Cancel" }));
    await expect.poll(location).toBe("/");
    await nextFrame();
    expect(overlay()).toBeNull();
  });

  test("with reduced motion Back completes in the next frame", async () => {
    await reduceMotion();
    const { location } = await openRouteSheet();
    expect(longest(await found(() => overlay()))).toBe(0);
    pressBack();
    await nextFrame();
    expect(location()).toBe("/");
    expect(overlay()).toBeNull();
  });
});

describe("a real route sheet (adding a pass)", () => {
  const NEW_PASS = `${PASSES}/new`;
  const openSheet = async () => {
    const device = await renderWithDevice({
      route: withBack(MEDICATION_ROUTES),
      url: PASSES,
      role: "caretaker",
      fixtures: [MORNING],
    });
    const add = page.getByRole("button", { name: "Add", exact: true });
    await userEvent.click(add);
    await userEvent.click(await found(() => menuItem("Pass")));
    await expect.poll(() => device.location()).toBe(NEW_PASS);
    await expect.element(page.getByRole("dialog", { name: "Add a pass" })).toBeVisible();
    return { device, add };
  };

  test.each([
    { way: "Cancel", leave: () => userEvent.click(page.getByRole("button", { name: "Cancel" })) },
    { way: "Back", leave: () => Promise.resolve(pressBack()) },
  ])("$way lands on the tab after the exit; focus returns to the opener", async ({ leave }) => {
    const { device, add } = await openSheet();
    await expect.poll(() => getComputedStyle(overlay()!).opacity).toBe("1");
    const exit = watchExit();
    await leave();
    await expect.poll(() => device.location()).toBe(PASSES);
    await expect.poll(overlay).toBeNull();
    expect((exit.removedAt ?? NaN) - (exit.exitAt ?? NaN)).toBeGreaterThanOrEqual(MOTION_MS - 20);
    await expect.poll(() => document.activeElement).toBe(add.element());
  });

  test.each([{ motion: "on" }, { motion: "reduced" }])(
    "a save lands on the tab with the new row, once (motion $motion)",
    async ({ motion }) => {
      if (motion === "reduced") await reduceMotion();
      const { device } = await openSheet();
      const dialog = page.getByRole("dialog", { name: "Add a pass" });
      await userEvent.fill(dialog.getByRole("textbox", { name: "Name" }), "Noon");
      await pickTime(
        () => document.querySelector<HTMLInputElement>('[role=dialog] input[name="time"]'),
        "12:00",
      );
      await userEvent.click(dialog.getByRole("button", { name: "Add pass" }));
      await expect.poll(() => device.location()).toBe(PASSES);
      await expect.poll(overlay).toBeNull();
      await expect.element(page.getByText("Noon", { exact: true })).toBeInTheDocument();
      await device.settle();
      const rows = await device.query("SELECT id FROM medication_pass WHERE name = 'Noon'");
      expect(rows).toHaveLength(1);
      const uploads = (await device.queued()).filter((w) => w.type === "medication_pass");
      expect(uploads).toHaveLength(1);
    },
  );
});

test("the filter sheet: a chip changes the search at once and the sheet stays open", async () => {
  const device = await openTimeline();
  await openFilters();
  await userEvent.click(chip("Vitals"));
  await expect.poll(() => device.location()).toBe(`${TIMELINE_URL}?kind=vital`);
  expect(overlay()?.hasAttribute("data-closing")).toBe(false);
  await expect.element(page.getByRole("dialog", { name: "Filter entries" })).toBeVisible();
});

test("stacked sheets: the top one exits alone; the one under it then navigates; one blocker", async () => {
  const warn = vi.spyOn(console, "warn");
  const BASE = "/app/groups/:groupId/todos";
  const LIST = `/app/groups/${TEST_GROUP.id}/todos`;
  const routes: DeviceRoute[] = [
    { path: BASE, module: todosRoute, children: [{ path: `${BASE}/new`, module: newTodo }] },
  ];
  const device = await renderWithDevice({ route: routes, url: `${LIST}/new`, role: "owner", fixtures: [] });
  const todo = page.getByRole("dialog", { name: "Add a todo" });
  await expect.element(todo).toBeVisible();
  await userEvent.fill(todo.getByLabelText("Due (optional)"), "2027-06-14");
  await userEvent.click(todo.getByRole("button", { name: "Repeat: Doesn't repeat" }));
  const repeat = page.getByRole("dialog", { name: "Repeat" });
  await expect.element(repeat).toBeVisible();

  await userEvent.keyboard("{Escape}");
  await expect.element(repeat).not.toBeInTheDocument();
  await expect.element(todo).toBeVisible();
  expect(device.location()).toBe(`${LIST}/new`);
  expect(document.querySelector('[data-sheet="overlay"][data-closing]')).toBeNull();

  // Escape reaches the sheet that holds focus, so wait for it to come back.
  await expect.poll(() => todo.element().contains(document.activeElement)).toBe(true);
  await userEvent.keyboard("{Escape}");
  await expect.poll(() => device.location().split("?")[0]).toBe(LIST);
  await expect.poll(overlay).toBeNull();
  expect(warn.mock.calls.flat().join(" ")).not.toContain("one blocker");
  warn.mockRestore();
});
