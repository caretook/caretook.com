import { EllipsisVertical, Plus } from "lucide-react";
import { describe, expect, test } from "vitest";

import { renderInRouter } from "../../../test/device";
import { buttonClass } from "./buttonClass";
import { Menu, TOOL_CIRCLE } from "./index";

const classSet = (el: Element) => [...el.classList].sort();
const ITEMS = [{ id: "edit", label: "Edit", onAction: () => undefined }];

describe("Menu's trigger", () => {
  test("given a look, it carries the classes buttonClass gives for it, then its outer classes", async () => {
    const { screen } = await renderInRouter(
      <>
        <Menu label="Add" title="Add" variant="primary" size="sm" shape="square" items={ITEMS}>
          <Plus className="size-4" aria-hidden="true" />
        </Menu>
        <Menu label="More" variant="ghost" className="ml-auto" items={ITEMS}>
          <EllipsisVertical className="size-4" aria-hidden="true" />
        </Menu>
      </>,
    );
    const add = screen.getByRole("button", { name: "Add" });
    expect(classSet(add.element())).toEqual(
      buttonClass({ variant: "primary", size: "sm", shape: "square" }).split(" ").sort(),
    );
    await expect.element(add).toHaveAttribute("title", "Add");
    expect(classSet(screen.getByRole("button", { name: "More" }).element())).toEqual(
      [...buttonClass({ variant: "ghost" }).split(" "), "ml-auto"].sort(),
    );
  });

  test("given a class string and no look, the trigger keeps exactly that string", async () => {
    const { screen } = await renderInRouter(
      <Menu label="Note actions" className={TOOL_CIRCLE} items={ITEMS}>
        <EllipsisVertical className="size-4" aria-hidden="true" />
      </Menu>,
    );
    await expect
      .element(screen.getByRole("button", { name: "Note actions" }))
      .toHaveAttribute("class", TOOL_CIRCLE);
  });
});
