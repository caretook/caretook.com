import { Search } from "lucide-react";
import { describe, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";

import { renderInRouter } from "../../../test/device";
import { ChipGroup, CIRCLE, FilterMenu, IconButton } from "./index";

// The list tools' outlined circle and the unselected chip show hover and
// press (B-617): their own `bg-base-100` used to beat daisyUI's layered
// `.btn:hover`, so nothing changed under the pointer. Each fills on hover, in
// both themes, fading on the kit's fast duration (motion.browser.test.tsx
// covers reduced motion for every `.btn`).

const SECTIONS = [
  {
    id: "status",
    title: "Status",
    defaultId: "all",
    options: [
      { id: "all", label: "All", search: "" },
      { id: "current", label: "Current", search: "?status=current" },
    ],
    current: "all",
  },
];

function Tools() {
  return (
    <div className="flex gap-2 p-4">
      <IconButton label="Search entries" icon={Search} onPress={() => undefined} className={CIRCLE} />
      <FilterMenu label="Filter medications" sections={SECTIONS} clear="" />
      <ChipGroup
        label="Show"
        links={[{ id: "notes", label: "Notes", name: "Notes", to: "?kind=note", current: false }]}
      />
    </div>
  );
}

const fill = (el: Element) => getComputedStyle(el).backgroundColor;

describe.each(["light", "dark"] as const)("in %s", (theme) => {
  test("the tool circles and an unselected chip fill on hover, then go back", async () => {
    await renderInRouter(<Tools />, { theme });
    const controls = [
      page.getByRole("button", { name: "Search entries" }),
      page.getByRole("button", { name: "Filter", exact: true }),
      page.getByRole("link", { name: "Notes" }),
    ];
    for (const control of controls) {
      const el = control.element();
      expect(getComputedStyle(el).transitionDuration.split(",").map(parseFloat)).toContain(0.12);
      const rest = fill(el);
      await userEvent.hover(control);
      await expect.poll(() => fill(el)).not.toBe(rest);
      await userEvent.unhover(control);
      await expect.poll(() => fill(el)).toBe(rest);
    }
  });
});
