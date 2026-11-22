import { Printer } from "lucide-react";
import { describe, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";

import { renderInRouter } from "../../../test/device";
import { found } from "../../../test/found";
import { buttonClass } from "./buttonClass";
import { Button, PageHeader } from "./index";

const classSet = (el: Element) => [...el.classList].sort();
const controls = () => [...document.querySelectorAll<HTMLElement>("header a, header button")];
const PLUS = buttonClass({ variant: "primary", size: "sm", shape: "square" }).split(" ").sort();
const PRINT = (
  <Button size="sm" variant="ghost" icon={Printer}>
    Print
  </Button>
);

describe("PageHeader's add", () => {
  test("as a link: the last control, after the actions, named by its label with it as its title, a primary small square + going to its target", async () => {
    const { screen, location } = await renderInRouter(
      <PageHeader
        title="Providers"
        actions={PRINT}
        add={{ label: "Add provider", to: "/providers/new", state: { sheet: true }, "data-add-provider": "" }}
      />,
    );
    const add = screen.getByRole("link", { name: "Add provider" });
    await expect.element(add).toHaveAttribute("title", "Add provider");
    await expect.element(add).toHaveAttribute("data-add-provider", "");
    expect(add.element().textContent).toBe("");
    expect(classSet(add.element())).toEqual(PLUS);
    expect(controls().map((c) => c.getAttribute("aria-label") ?? c.textContent)).toEqual([
      "Print",
      "Add provider",
    ]);
    // At the top right of the header.
    const header = document.querySelector("header")!.getBoundingClientRect();
    const plus = add.element().getBoundingClientRect();
    expect(Math.round(header.right - plus.right)).toBeLessThanOrEqual(1);
    expect(plus.top - header.top).toBeLessThan(8);
    await userEvent.click(add);
    await expect.poll(location).toBe("/providers/new");
  });

  test("as a callback: a button that calls back", async () => {
    let pressed = 0;
    const { screen } = await renderInRouter(
      <PageHeader title="Care periods" add={{ label: "Add period", onPress: () => pressed++ }} />,
    );
    const add = screen.getByRole("button", { name: "Add period" });
    await expect.element(add).toHaveAttribute("title", "Add period");
    expect(classSet(add.element())).toEqual(PLUS);
    await userEvent.click(add);
    expect(pressed).toBe(1);
  });

  test("as menu items: the + opens a menu that lists them, and an item acts", async () => {
    const chosen: string[] = [];
    const { screen } = await renderInRouter(
      <PageHeader
        title="Planner"
        actions={PRINT}
        add={{
          label: "Add",
          "data-add-menu": "",
          items: [
            { id: "appointment", label: "Appointment", onAction: () => chosen.push("appointment") },
            { id: "todo", label: "Todo", onAction: () => chosen.push("todo") },
          ],
        }}
      />,
    );
    const add = screen.getByRole("button", { name: "Add", exact: true });
    await expect.element(add).toHaveAttribute("title", "Add");
    await expect.element(add).toHaveAttribute("data-add-menu", "");
    expect(classSet(add.element())).toEqual(PLUS);
    expect(controls().at(-1)).toBe(add.element());
    await userEvent.click(add);
    const menu = page.getByRole("menu", { name: "Add" });
    await expect.element(menu).toBeVisible();
    expect(
      menu
        .getByRole("menuitem")
        .elements()
        .map((el) => el.textContent),
    ).toEqual(["Appointment", "Todo"]);
    await userEvent.click(page.getByRole("menuitem", { name: "Todo" }));
    expect(chosen).toEqual(["todo"]);
  });

  test("without add the header is as before: the title and the actions only", async () => {
    await renderInRouter(<PageHeader title="Medications" actions={PRINT} add={false} />);
    expect(controls().map((c) => c.textContent)).toEqual(["Print"]);
  });

  test("with neither, the header holds only its title", async () => {
    await renderInRouter(<PageHeader title="Providers" />);
    const header = await found(() => document.querySelector("header"));
    expect([...header.children].map((el) => el.tagName)).toEqual(["H1"]);
  });
});
