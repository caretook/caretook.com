import { Pencil, Rows3, Trash2 } from "lucide-react";
import { useState } from "react";
import { describe, expect, test, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { renderInRouter } from "../../../test/device";
import {
  ChipGroup,
  ChoiceGroup,
  ConfirmDialog,
  Field,
  IconButton,
  Menu,
  Popover,
  SEPARATOR,
  Sheet,
} from "./index";
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
    expect(getComputedStyle(menu.element().parentElement!).backgroundColor).toBe(base100());

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
    expect(getComputedStyle(dialog.element().parentElement!).backgroundColor).toBe(base100());

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
    expect(getComputedStyle(dialog.element().parentElement!).backgroundColor).toBe(base100());
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
