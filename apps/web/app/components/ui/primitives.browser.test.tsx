import { Pencil, Rows3, Trash2 } from "lucide-react";
import { useLayoutEffect, useState } from "react";
import { createRoutesStub, Link, Outlet, useLocation, useNavigate } from "react-router";
import { render } from "vitest-browser-react";
import { describe, expect, test, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import type { FilterMenuProps } from "./index";

import { renderInRouter } from "../../../test/device";
import { found } from "../../../test/found";
import {
  ChipGroup,
  ChoiceGroup,
  ConfirmDialog,
  Field,
  FilterMenu,
  FilterMenuChips,
  IconButton,
  Menu,
  Popover,
  SEPARATOR,
  Sheet,
  TabNav,
} from "./index";
import { DateTimeField } from "./date";
import { buttonClass } from "./buttonClass";
import { Tooltip } from "./tooltip";

// The ui/ primitives' behaviour (what ui.mjs checks through screens), on the
// primitives themselves: real taps and keys in Chromium, at 420 and 1280, in
// light and dark.

const LAYOUTS = [
  { width: 420, theme: "light" },
  { width: 420, theme: "dark" },
  { width: 1280, theme: "light" },
  { width: 1280, theme: "dark" },
] as const;

/** The theme's `base-100`, read off a probe: menus, popovers and sheets sit on it. */
const base100 = () => {
  const probe = document.createElement("div");
  probe.className = "bg-base-100";
  document.body.append(probe);
  const color = getComputedStyle(probe).backgroundColor;
  probe.remove();
  return color;
};

const active = () => document.activeElement;

/** Back (history −1), as the browser's button does. */
let back = () => {};
function BackProbe() {
  const navigate = useNavigate();
  useLayoutEffect(() => {
    back = () => void navigate(-1);
  }, [navigate]);
  return null;
}

const SCHEDULE = "/m/schedule";
const LIST = "/m/list";
const PASSES = "/m/passes";
const TABS = [
  { label: "Schedule", to: SCHEDULE },
  {
    label: "Medications",
    to: LIST,
    match: (path: string) => path.startsWith(LIST) || path.startsWith("/m/med-"),
  },
  { label: "Passes", to: PASSES },
];

describe.each(LAYOUTS)("at $width, $theme", ({ width, theme }) => {
  test("Menu: a tap opens it named, with its items; a choice closes it and focus returns", async () => {
    const onEdit = vi.fn();
    const onTheme = vi.fn();
    const { screen } = await renderInRouter(
      <Menu
        label="Actions for note"
        items={[
          { id: "edit", label: "Edit", icon: Pencil, onAction: onEdit },
          {
            type: "section",
            id: "theme",
            title: "Theme",
            selection: { selected: "light", onChange: onTheme },
            items: [
              { id: "light", label: "Light" },
              { id: "dark", label: "Dark" },
            ],
          },
          SEPARATOR,
          { id: "delete", label: "Delete", icon: Trash2, tone: "danger", onAction: () => undefined },
        ]}
      >
        ⋯
      </Menu>,
      { width, theme },
    );
    const trigger = screen.getByRole("button", { name: "Actions for note" });
    await userEvent.click(trigger);
    const menu = page.getByRole("menu", { name: "Actions for note" });
    await expect.element(menu).toBeVisible();
    await expect.element(page.getByRole("menuitem", { name: "Edit" })).toBeVisible();
    await expect.element(page.getByRole("menuitemradio", { name: "Light" })).toBeChecked();
    await expect.element(page.getByRole("menuitemradio", { name: "Dark" })).not.toBeChecked();
    await expect.element(page.getByRole("separator")).toBeInTheDocument();
    // The surface follows the theme.
    expect(getComputedStyle(await found(() => menu.element().parentElement)).backgroundColor).toBe(base100());

    await userEvent.click(page.getByRole("menuitem", { name: "Edit" }));
    expect(onEdit).toHaveBeenCalledOnce();
    await expect.element(menu).not.toBeInTheDocument();
    await expect.poll(active).toBe(trigger.element());
  });

  test("Menu: Enter opens it on the first item, arrows move, Escape closes and focus returns", async () => {
    const onTheme = vi.fn();
    const { screen } = await renderInRouter(
      <Menu
        label="Account menu"
        items={[
          {
            type: "section",
            id: "who",
            header: { title: "Alex Moreno", subtitle: "alex.moreno@example.com" },
            items: [],
          },
          {
            type: "section",
            id: "theme",
            title: "Theme",
            selection: { selected: "system", onChange: onTheme },
            items: [
              { id: "system", label: "System" },
              { id: "light", label: "Light" },
              { id: "dark", label: "Dark" },
            ],
          },
        ]}
      >
        AM
      </Menu>,
      { width, theme },
    );
    const trigger = screen.getByRole("button", { name: "Account menu" });
    (trigger.element() as HTMLElement).focus();
    await userEvent.keyboard("{Enter}");
    await expect.element(page.getByRole("menu")).toBeVisible();
    // The header is never focused: the first item is.
    await expect.poll(active).toBe(page.getByRole("menuitemradio", { name: "System" }).element());
    await userEvent.keyboard("{ArrowDown}");
    await expect.poll(active).toBe(page.getByRole("menuitemradio", { name: "Light" }).element());
    await userEvent.keyboard("{Enter}");
    expect(onTheme).toHaveBeenCalledWith("light");
    await expect.element(page.getByRole("menu")).not.toBeInTheDocument();
    await expect.poll(active).toBe(trigger.element());

    await userEvent.keyboard("{ArrowDown}");
    await expect.element(page.getByRole("menu")).toBeVisible();
    await userEvent.keyboard("{Escape}");
    await expect.element(page.getByRole("menu")).not.toBeInTheDocument();
    await expect.poll(active).toBe(trigger.element());
  });

  test("Menu: a group expands in place with a press and with Enter, keeps the menu open, and starts closed when the menu reopens", async () => {
    const onWeight = vi.fn();
    const { screen } = await renderInRouter(
      <Menu
        label="Add"
        items={[
          { id: "note", label: "Note", onAction: () => undefined },
          {
            type: "group",
            id: "vitals",
            label: "Vitals",
            icon: Rows3,
            items: [
              { id: "weight", label: "Weight", onAction: onWeight },
              { id: "pulse", label: "Pulse", onAction: () => undefined },
            ],
          },
        ]}
      >
        +
      </Menu>,
      { width, theme },
    );
    const trigger = screen.getByRole("button", { name: "Add" });
    const menu = page.getByRole("menu", { name: "Add" });
    const group = page.getByRole("menuitem", { name: "Vitals" });
    const weight = page.getByRole("menuitem", { name: "Weight" });
    const names = () => [...document.querySelectorAll('[role="menuitem"]')].map((el) => el.textContent);

    // A press: open, then closed again; the menu stays open throughout.
    await userEvent.click(trigger);
    await expect.element(group).toHaveAttribute("aria-expanded", "false");
    expect(names()).toEqual(["Note", "Vitals"]);
    await userEvent.click(group);
    await expect.element(group).toHaveAttribute("aria-expanded", "true");
    expect(names()).toEqual(["Note", "Vitals", "Weight", "Pulse"]);
    expect(weight.element().hasAttribute("data-menu-group-item")).toBe(true);
    await expect.element(menu).toBeVisible();
    await userEvent.click(group);
    await expect.element(group).toHaveAttribute("aria-expanded", "false");
    await expect.element(weight).not.toBeInTheDocument();
    await expect.element(menu).toBeVisible();

    // Enter: expands it, focus stays on it; the arrow reaches its items, and one acts and closes the menu.
    await userEvent.keyboard("{Escape}");
    await expect.element(menu).not.toBeInTheDocument();
    (trigger.element() as HTMLElement).focus();
    await userEvent.keyboard("{Enter}");
    await expect.poll(active).toBe(page.getByRole("menuitem", { name: "Note" }).element());
    await userEvent.keyboard("{ArrowDown}");
    await expect.poll(active).toBe(group.element());
    await userEvent.keyboard("{Enter}");
    await expect.element(group).toHaveAttribute("aria-expanded", "true");
    await expect.element(menu).toBeVisible();
    expect(active()).toBe(group.element());
    await userEvent.keyboard("{ArrowDown}");
    await expect.poll(active).toBe(weight.element());
    await userEvent.keyboard("{Enter}");
    expect(onWeight).toHaveBeenCalledOnce();
    await expect.element(menu).not.toBeInTheDocument();
    await expect.poll(active).toBe(trigger.element());

    // Reopened: the group is closed again.
    await userEvent.click(trigger);
    await expect.element(group).toHaveAttribute("aria-expanded", "false");
    expect(names()).toEqual(["Note", "Vitals"]);
    await userEvent.keyboard("{Escape}");
  });

  test("Menu: a link item navigates through the router", async () => {
    const { location } = await renderInRouter(
      <Menu
        label="Group menu"
        items={[{ id: "settings", label: "Group settings", href: "/app/groups/g/settings" }]}
      >
        Grandma June
      </Menu>,
      { url: "/app/groups/g/timeline", width, theme },
    );
    await userEvent.click(page.getByRole("button", { name: "Group menu" }));
    await userEvent.click(page.getByRole("menuitem", { name: "Group settings" }));
    await expect.poll(location).toBe("/app/groups/g/settings");
  });

  test("Sheet: named, focus moves in, Escape closes it and focus returns to the opener", async () => {
    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Add symptom
          </button>
          {open && (
            <Sheet isOpen onOpenChange={setOpen} title="New symptom">
              <input aria-label="What" />
            </Sheet>
          )}
        </>
      );
    }
    const { screen } = await renderInRouter(<Harness />, { width, theme });
    const opener = screen.getByRole("button", { name: "Add symptom" });
    await userEvent.click(opener);
    const dialog = page.getByRole("dialog", { name: "New symptom" });
    await expect.element(dialog).toBeVisible();
    await expect.poll(() => dialog.element().contains(active())).toBe(true);
    const box = dialog.element().parentElement!.getBoundingClientRect();
    // Full screen on phones (B-73), a centred dialog from `sm`.
    if (width < 640) expect(Math.round(box.width)).toBe(width);
    else expect(box.width).toBeLessThan(width / 2);
    expect(getComputedStyle(await found(() => dialog.element().parentElement)).backgroundColor).toBe(
      base100(),
    );

    await userEvent.keyboard("{Escape}");
    await expect.element(dialog).not.toBeInTheDocument();
    await expect.poll(active).toBe(opener.element());

    // Close by its button, too.
    await userEvent.click(opener);
    await userEvent.click(page.getByRole("button", { name: "Close" }));
    await expect.element(page.getByRole("dialog")).not.toBeInTheDocument();
    await expect.poll(active).toBe(opener.element());
  });

  test("Popover: a tap opens a named dialog with focus inside; Escape closes it and focus returns; Done closes too", async () => {
    const { screen } = await renderInRouter(
      <Popover label="Change the time" dialogLabel="When" trigger="4:40 PM">
        {(close) => (
          <>
            <input aria-label="Time" />
            <button type="button" onClick={close}>
              Done
            </button>
          </>
        )}
      </Popover>,
      { width, theme },
    );
    const trigger = screen.getByRole("button", { name: "Change the time" });
    await userEvent.click(trigger);
    const dialog = page.getByRole("dialog", { name: "When" });
    await expect.element(dialog).toBeVisible();
    await expect.poll(() => dialog.element().contains(active())).toBe(true);
    expect(getComputedStyle(await found(() => dialog.element().parentElement)).backgroundColor).toBe(
      base100(),
    );
    await userEvent.keyboard("{Escape}");
    await expect.element(dialog).not.toBeInTheDocument();
    await expect.poll(active).toBe(trigger.element());

    (trigger.element() as HTMLElement).focus();
    await userEvent.keyboard("{Enter}");
    await userEvent.click(page.getByRole("button", { name: "Done" }));
    await expect.element(page.getByRole("dialog")).not.toBeInTheDocument();
    await expect.poll(active).toBe(trigger.element());
  });

  test("Tooltip: hover and keyboard focus show it as the control's description, never its name; Escape hides it", async () => {
    await renderInRouter(
      <>
        <button type="button">Before</button>
        <Tooltip content="Sam Okafor">
          <a href="/t?author=sam" aria-label="Show only Sam Okafor's entries">
            SO
          </a>
        </Tooltip>
      </>,
      { width, theme },
    );
    const link = page.getByRole("link", { name: "Show only Sam Okafor's entries" });
    await userEvent.hover(link);
    const tip = page.getByRole("tooltip");
    await expect.element(tip).toHaveTextContent("Sam Okafor");
    await expect.element(link).toHaveAccessibleDescription("Sam Okafor");
    expect(getComputedStyle(tip.element()).backgroundColor).toBe(base100());
    await userEvent.unhover(link);
    await expect.element(tip).not.toBeInTheDocument();

    await userEvent.click(page.getByRole("button", { name: "Before" }));
    await userEvent.tab();
    await expect.element(page.getByRole("tooltip")).toBeVisible();
    await userEvent.keyboard("{Escape}");
    await expect.element(page.getByRole("tooltip")).not.toBeInTheDocument();
    await expect.element(link).toHaveAccessibleName("Show only Sam Okafor's entries");
  });

  test("ConfirmDialog: a modal named and described; Escape and Cancel close it, focus returns; confirm can be held back", async () => {
    const onConfirm = vi.fn();
    function Harness({ blocked = false }: { blocked?: boolean }) {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Delete entry
          </button>
          <ConfirmDialog
            open={open}
            title="Delete this note?"
            message="It's removed for everyone in the group."
            confirmLabel="Delete"
            confirmDisabled={blocked}
            onConfirm={onConfirm}
            onClose={() => setOpen(false)}
          />
        </>
      );
    }
    const { screen } = await renderInRouter(<Harness />, { width, theme });
    const opener = screen.getByRole("button", { name: "Delete entry" });
    await userEvent.click(opener);
    const dialog = page.getByRole("dialog", { name: "Delete this note?" });
    await expect.element(dialog).toBeVisible();
    await expect.element(dialog).toHaveAccessibleDescription("It's removed for everyone in the group.");
    const native = dialog.element() as HTMLDialogElement;
    expect(native.matches(":modal")).toBe(true);
    await userEvent.keyboard("{Escape}");
    await expect.poll(() => native.open).toBe(false);
    await expect.poll(active).toBe(opener.element());

    await userEvent.click(opener);
    await userEvent.click(page.getByRole("button", { name: "Cancel" }));
    await expect.poll(() => native.open).toBe(false);
    await userEvent.click(opener);
    await userEvent.click(page.getByRole("button", { name: "Delete", exact: true }));
    expect(onConfirm).toHaveBeenCalledOnce();

    await screen.rerender(<Harness blocked />);
    await userEvent.click(page.getByRole("button", { name: "Delete entry" }));
    await expect.element(page.getByRole("button", { name: "Delete", exact: true })).toBeDisabled();
    await userEvent.click(page.getByRole("button", { name: "Cancel" }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  test("Field: the label names the control; help, error and warning are described", async () => {
    const { screen, rerenderField } = await renderField({ width, theme });
    const input = screen.getByRole("textbox", { name: "What is it?" });
    await expect.element(input).toHaveAccessibleDescription("Say it in a few words.");
    await expect.element(input).not.toHaveAttribute("aria-invalid");

    await rerenderField({ warning: "That's unusual. Double-check it" });
    await expect
      .element(input)
      .toHaveAccessibleDescription("Say it in a few words. That's unusual. Double-check it");
    await expect.element(input).not.toHaveAttribute("aria-invalid");

    await rerenderField({ error: "Name the symptom", warning: "That's unusual. Double-check it" });
    await expect.element(input).toHaveAttribute("aria-invalid", "true");
    await expect.element(input).toHaveAccessibleDescription("Say it in a few words. Name the symptom");
  });

  test("ChoiceGroup: a named radiogroup; arrow keys move the choice", async () => {
    const onChange = vi.fn();
    function Harness() {
      const [value, setValue] = useState<"rows" | "cards">("rows");
      return (
        <ChoiceGroup
          name="layout"
          label="Timeline layout"
          value={value}
          onChange={(v) => {
            setValue(v);
            onChange(v);
          }}
          options={[
            { value: "rows", label: "Rows" },
            { value: "cards", label: "Cards" },
          ]}
        />
      );
    }
    await renderInRouter(<Harness />, { width, theme });
    const group = page.getByRole("radiogroup", { name: "Timeline layout" });
    await expect.element(group).toBeVisible();
    await expect.element(page.getByRole("radio", { name: "Rows" })).toBeChecked();
    await userEvent.click(page.getByRole("radio", { name: "Rows" }));
    await userEvent.keyboard("{ArrowRight}");
    await expect.element(page.getByRole("radio", { name: "Cards" })).toBeChecked();
    expect(onChange).toHaveBeenLastCalledWith("cards");
  });

  test("ChipGroup: link chips are a named nav with aria-current; action chips are a list, toggles pressed", async () => {
    const onPick = vi.fn();
    const { location } = await renderInRouter(
      <>
        <ChipGroup
          label="Show entries"
          links={[
            { id: "all", label: "All", to: "/t", current: false },
            { id: "note", label: "Notes", to: "/t?kind=note", current: true },
          ]}
        />
        <ChipGroup
          label="Suggested titles"
          actions={[
            { id: "a", label: "Cardiology visit", onPress: onPick },
            { id: "b", label: "Only mine", onPress: () => undefined, pressed: true },
          ]}
        />
      </>,
      { url: "/t?kind=note", width, theme },
    );
    const nav = page.getByRole("navigation", { name: "Show entries" });
    await expect.element(nav.getByRole("link", { name: "Notes" })).toHaveAttribute("aria-current", "true");
    await expect.element(nav.getByRole("link", { name: "All" })).not.toHaveAttribute("aria-current");
    await userEvent.click(nav.getByRole("link", { name: "All" }));
    await expect.poll(location).toBe("/t");

    const list = page.getByRole("list", { name: "Suggested titles" });
    await userEvent.click(list.getByRole("button", { name: "Cardiology visit" }));
    expect(onPick).toHaveBeenCalledOnce();
    await expect
      .element(list.getByRole("button", { name: "Only mine" }))
      .toHaveAttribute("aria-pressed", "true");
  });

  test("IconButton: named by its label (and title); a toggle is pressed; `to` makes a link", async () => {
    await renderInRouter(
      <>
        <IconButton label="Rows" icon={Rows3} pressed onPress={() => undefined} />
        <IconButton label="Search this care group" icon={Rows3} to="/search" />
      </>,
      { width, theme },
    );
    await expect.element(page.getByRole("button", { name: "Rows" })).toHaveAttribute("aria-pressed", "true");
    await expect.element(page.getByRole("button", { name: "Rows" })).toHaveAttribute("title", "Rows");
    await expect
      .element(page.getByRole("link", { name: "Search this care group" }))
      .toHaveAttribute("href", "/search");
  });
  test("TabNav: a named nav of links; the current tab is marked, a tap and Back move it, keys reach and follow each", async () => {
    const { location } = await renderInRouter(
      <>
        <BackProbe />
        <button type="button">Before</button>
        <TabNav label="Medications views" tabs={TABS} />
      </>,
      { url: SCHEDULE, width, theme },
    );
    const nav = page.getByRole("navigation", { name: "Medications views" });
    const tab = (name: string) => nav.getByRole("link", { name });
    await expect.element(tab("Schedule")).toHaveAttribute("aria-current", "page");
    await expect.element(tab("Medications")).not.toHaveAttribute("aria-current");
    await expect.element(tab("Passes")).not.toHaveAttribute("aria-current");

    await userEvent.click(tab("Medications"));
    await expect.poll(location).toBe(LIST);
    await expect.element(tab("Medications")).toHaveAttribute("aria-current", "page");
    await expect.element(tab("Schedule")).not.toHaveAttribute("aria-current");

    back();
    await expect.poll(location).toBe(SCHEDULE);
    await expect.element(tab("Schedule")).toHaveAttribute("aria-current", "page");
    await expect.element(tab("Medications")).not.toHaveAttribute("aria-current");

    // Tab reaches each link in order; Enter follows the focused one.
    page.getByRole("button", { name: "Before" }).element().focus();
    await userEvent.keyboard("{Tab}");
    expect(active()).toBe(tab("Schedule").element());
    await userEvent.keyboard("{Tab}");
    expect(active()).toBe(tab("Medications").element());
    await userEvent.keyboard("{Tab}");
    expect(active()).toBe(tab("Passes").element());
    await userEvent.keyboard("{Enter}");
    await expect.poll(location).toBe(PASSES);
    await expect.element(tab("Passes")).toHaveAttribute("aria-current", "page");
  });

  test("TabNav: a path under a tab keeps it current, and `match` claims other paths", async () => {
    const { location } = await renderInRouter(
      <>
        <TabNav label="Medications views" tabs={TABS} />
        <Link to={`${LIST}/new`}>Add over the list</Link>
        <Link to="/m/med-1">A medication</Link>
        <Link to="/m/other">Elsewhere</Link>
      </>,
      { url: SCHEDULE, width, theme },
    );
    const nav = page.getByRole("navigation", { name: "Medications views" });
    const marked = () =>
      [...nav.element().querySelectorAll('[aria-current="page"]')].map((el) => el.textContent);

    await userEvent.click(page.getByRole("link", { name: "Add over the list" }));
    await expect.poll(location).toBe(`${LIST}/new`);
    expect(marked()).toEqual(["Medications"]);

    await userEvent.click(page.getByRole("link", { name: "A medication" }));
    await expect.poll(location).toBe("/m/med-1");
    expect(marked()).toEqual(["Medications"]);

    await userEvent.click(page.getByRole("link", { name: "Elsewhere" }));
    await expect.poll(location).toBe("/m/other");
    expect(marked()).toEqual([]);
  });
});

describe("TabNav pending", () => {
  // Tabs whose routes are real: the list's loader never resolves.
  function Page() {
    return (
      <>
        <TabNav label="Medications views" tabs={TABS} />
        <Link to={SCHEDULE}>Stay here</Link>
        <Outlet />
      </>
    );
  }
  test("a tap marks the tab at once while its loader is pending, a superseded navigation moves it back, and the links prefetch", async () => {
    const Stub = createRoutesStub([
      {
        id: "page",
        path: "/m",
        Component: Page,
        children: [
          { path: "schedule", Component: () => null },
          { path: "list", loader: () => new Promise(() => {}), Component: () => null },
          { path: "passes", Component: () => null },
        ],
      },
    ]);
    await render(<Stub initialEntries={[SCHEDULE]} />);
    const nav = page.getByRole("navigation", { name: "Medications views" });
    const tab = (name: string) => nav.getByRole("link", { name });
    await expect.element(tab("Schedule")).toHaveAttribute("aria-current", "page");
    // The links prefetch their targets.
    await expect.poll(() => document.querySelectorAll('link[rel="prefetch"]').length).toBeGreaterThan(0);

    await userEvent.click(tab("Medications"));
    await expect.element(tab("Medications")).toHaveAttribute("aria-current", "page");
    await expect.element(tab("Schedule")).not.toHaveAttribute("aria-current");

    await userEvent.click(page.getByRole("link", { name: "Stay here" }));
    await expect.element(tab("Schedule")).toHaveAttribute("aria-current", "page");
    await expect.element(tab("Medications")).not.toHaveAttribute("aria-current");
  });
});

describe("DateTimeField", () => {
  const ZONE = "America/Los_Angeles";
  const segment = (type: string) => document.querySelector<HTMLElement>(`[data-type="${type}"]`)!;
  /** Focus a segment of a field starting at `iso`, press `key`, and return what onChange got. */
  const step = async (iso: string, type: "month" | "year", key: string) => {
    const onChange = vi.fn<(iso: string) => void>();
    await renderInRouter(
      <DateTimeField label="Start from" defaultValue={iso} timeZone={ZONE} onChange={onChange} />,
    );
    segment(type).focus();
    await userEvent.keyboard(key);
    await expect.poll(() => onChange.mock.calls.length).toBe(1);
    return onChange.mock.calls[0]![0];
  };

  // Each at 10:00 in Los Angeles (UTC−7 in summer time, −8 in winter).
  test("a month stepped back from the 31st clamps the day: 31 October to 30 September", async () => {
    expect(await step("2026-10-31T17:00:00.000Z", "month", "{ArrowDown}")).toBe("2026-09-30T17:00:00.000Z");
    await expect.poll(() => [segment("month").textContent, segment("day").textContent]).toEqual(["9", "30"]);
  });

  test("31 March to 29 February in a leap year", async () => {
    expect(await step("2028-03-31T17:00:00.000Z", "month", "{ArrowDown}")).toBe("2028-02-29T18:00:00.000Z");
  });

  test("a year stepped off 29 February clamps to the 28th", async () => {
    expect(await step("2028-02-29T18:00:00.000Z", "year", "{ArrowDown}")).toBe("2027-02-28T18:00:00.000Z");
  });

  test("a step that keeps the day is React Aria's own", async () => {
    expect(await step("2026-10-15T17:00:00.000Z", "month", "{ArrowDown}")).toBe("2026-09-15T17:00:00.000Z");
  });

  test("a placeholder segment takes the text-faint tone, not a faded opacity", async () => {
    await renderInRouter(
      <DateTimeField
        label="Start from"
        defaultValue="2026-10-15T17:00:00.000Z"
        timeZone="America/Los_Angeles"
      />,
    );
    const classes = document.querySelector<HTMLElement>('[data-type="month"]')!.className;
    expect(classes).toContain("data-[placeholder]:text-faint");
    expect(classes).not.toContain("opacity");
  });
});

/** A `Field` around an input, re-rendered with new props. */
const renderField = async (options: { width: number; theme: "light" | "dark" }) => {
  const field = (props: { error?: string; warning?: string }) => (
    <Field label="What is it?" help="Say it in a few words." {...props}>
      {(control) => <input {...control} className="input" />}
    </Field>
  );
  const { screen } = await renderInRouter(field({}), options);
  return {
    screen,
    rerenderField: (props: { error?: string; warning?: string }) => screen.rerender(field(props)),
  };
};

describe("FilterMenu", () => {
  // A list with two filters in the URL, `?size=` (S, L) and `?color=` (Red), and a search (`?q=`) the menu keeps.
  const withParam = (search: string, key: string, value: string | null) => {
    const params = new URLSearchParams(search);
    if (value) params.set(key, value);
    else params.delete(key);
    const text = params.toString();
    return text ? `?${text}` : "";
  };
  const filters = (search: string, extra = false): FilterMenuProps => {
    const params = new URLSearchParams(search);
    return {
      label: "Filter shirts",
      clear: withParam(withParam(search, "size", null), "color", null),
      sections: [
        {
          id: "size",
          title: "Size",
          current: params.get("size") ?? "any",
          defaultId: "any",
          options: [
            { id: "any", label: "Any size", search: withParam(search, "size", null) },
            { id: "s", label: "Small", search: withParam(search, "size", "s") },
            { id: "l", label: "Large", search: withParam(search, "size", "l") },
          ],
        },
        {
          id: "color",
          title: "Color",
          current: params.get("color") ?? "any",
          defaultId: "any",
          options: [
            { id: "any", label: "Any color", search: withParam(search, "color", null) },
            { id: "red", label: "Red", search: withParam(search, "color", "red") },
          ],
        },
      ],
      chips: extra ? [{ id: "maker", label: "By Ann", search: withParam(search, "maker", null) }] : [],
    };
  };
  function Shirts({ extra = false }: { extra?: boolean }) {
    const { search } = useLocation();
    const props = filters(search, extra);
    return (
      <>
        <BackProbe />
        <Link to="/shirts?q=tee">Shirts</Link>
        <FilterMenu {...props} />
        <FilterMenuChips {...props} />
      </>
    );
  }
  const button = () => page.getByRole("button", { name: /^Filter(, \d+ on)?$/ });
  const badge = () => document.querySelector("[data-filter-count]")?.textContent;
  const chips = () =>
    [...document.querySelectorAll('nav[aria-label="Filters on"] a')].map((a) => a.getAttribute("aria-label"));

  test("named Filter with no badge and no chips; Filter, 2 on with a badge of 2 and a chip each", async () => {
    const { screen } = await renderInRouter(<Shirts />, { url: "/shirts" });
    await expect.element(button()).toHaveAccessibleName("Filter");
    await expect.element(button()).toHaveAttribute("title", "Filter");
    expect(badge()).toBeUndefined();
    expect(document.querySelector('nav[aria-label="Filters on"]')).toBeNull();
    await screen.unmount();

    await renderInRouter(<Shirts />, { url: "/shirts?size=l&color=red" });
    await expect.element(button()).toHaveAccessibleName("Filter, 2 on");
    await expect.element(button()).toHaveAttribute("title", "Filter, 2 on");
    expect(badge()).toBe("2");
    expect(chips()).toEqual(["Large: clear this filter", "Red: clear this filter"]);
  });

  test("Enter opens it named, each section's current option checked; arrows move; Escape closes with focus back", async () => {
    await renderInRouter(<Shirts />, { url: "/shirts?size=s" });
    (button().element() as HTMLElement).focus();
    await userEvent.keyboard("{Enter}");
    await expect.element(page.getByRole("menu", { name: "Filter shirts" })).toBeVisible();
    await expect.element(page.getByRole("menuitemradio", { name: "Small" })).toBeChecked();
    await expect.element(page.getByRole("menuitemradio", { name: "Any size" })).not.toBeChecked();
    await expect.element(page.getByRole("menuitemradio", { name: "Any color" })).toBeChecked();
    await expect.poll(active).toBe(page.getByRole("menuitemradio", { name: "Any size" }).element());
    await userEvent.keyboard("{ArrowDown}");
    await expect.poll(active).toBe(page.getByRole("menuitemradio", { name: "Small" }).element());
    await userEvent.keyboard("{Escape}");
    await expect.element(page.getByRole("menu")).not.toBeInTheDocument();
    await expect.poll(active).toBe(button().element());
  });

  test("a choice goes to its search in place of the entry (Back skips it) and closes the menu", async () => {
    const { location } = await renderInRouter(<Shirts />, { url: "/start" });
    await userEvent.click(page.getByRole("link", { name: "Shirts" }));
    await expect.poll(location).toBe("/shirts?q=tee");
    await userEvent.click(button());
    await userEvent.click(page.getByRole("menuitemradio", { name: "Red" }));
    await expect.poll(location).toBe("/shirts?q=tee&color=red");
    await expect.element(page.getByRole("menu")).not.toBeInTheDocument();
    await expect.element(button()).toHaveAccessibleName("Filter, 1 on");
    await userEvent.click(button());
    await userEvent.click(page.getByRole("menuitemradio", { name: "Large" }));
    await expect.poll(location).toBe("/shirts?q=tee&color=red&size=l");
    back();
    await expect.poll(location).toBe("/start");
  });

  test("a chip's ✕ clears only its filter; Clear filters (only while any is on) keeps the search; extra chips show, uncounted", async () => {
    const { location } = await renderInRouter(<Shirts extra />, {
      url: "/shirts?q=tee&size=l&color=red&maker=ann",
    });
    await expect.element(button()).toHaveAccessibleName("Filter, 2 on");
    expect(chips()).toEqual([
      "Large: clear this filter",
      "Red: clear this filter",
      "By Ann: clear this filter",
    ]);
    await userEvent.click(page.getByRole("link", { name: "Red: clear this filter" }));
    await expect.poll(location).toBe("/shirts?q=tee&size=l&maker=ann");
    await expect.element(button()).toHaveAccessibleName("Filter, 1 on");

    await userEvent.click(button());
    await userEvent.click(page.getByRole("menuitem", { name: "Clear filters" }));
    await expect.poll(location).toBe("/shirts?q=tee&maker=ann");
    await expect.element(button()).toHaveAccessibleName("Filter");
    expect(chips()).toEqual(["By Ann: clear this filter"]);
    await userEvent.click(button());
    await expect.element(page.getByRole("menu")).toBeVisible();
    expect(page.getByRole("menuitem", { name: "Clear filters" }).elements()).toEqual([]);
    await userEvent.keyboard("{Escape}");
  });
});

describe("danger text", () => {
  test("a danger menu item carries text-error-ink, not text-error", async () => {
    const { screen } = await renderInRouter(
      <Menu label="More" items={[{ id: "del", label: "Delete", tone: "danger", onAction: () => undefined }]}>
        <Trash2 className="size-4" aria-hidden="true" />
      </Menu>,
    );
    await userEvent.click(screen.getByRole("button", { name: "More" }));
    const item = screen.getByRole("menuitem", { name: "Delete" }).element();
    expect(item.classList.contains("text-error-ink")).toBe(true);
    expect(item.classList.contains("text-error")).toBe(false);
  });

  test("a dangerQuiet button carries text-error-ink, not text-error", () => {
    const classes = buttonClass({ variant: "dangerQuiet" }).split(" ");
    expect(classes).toContain("text-error-ink");
    expect(classes).not.toContain("text-error");
  });
});
