import { describe, expect, test, vi } from "vitest";
import { userEvent } from "vitest/browser";

import { renderInRouter } from "../../../test/device";
import { Button, List, ListRow } from "./index";

describe("List", () => {
  test("is a list of its rows, with their data hooks", async () => {
    const { screen } = await renderInRouter(
      <List label="Devices" data-devices="">
        <ListRow data-device="a">Laptop</ListRow>
        <ListRow data-device="b" trailing={<Button size="sm">Sign out</Button>}>
          Phone
        </ListRow>
      </List>,
    );
    const list = screen.getByRole("list", { name: "Devices" });
    await expect.element(list).toBeVisible();
    expect(list.element().hasAttribute("data-devices")).toBe(true);
    expect(screen.getByRole("listitem").elements()).toHaveLength(2);
    expect(document.querySelectorAll("[data-device]")).toHaveLength(2);
  });

  test("a row with `to` is one link covering the row; its trailing control is still clickable", async () => {
    const onClick = vi.fn();
    const { screen, location } = await renderInRouter(
      <List>
        <ListRow
          to="/providers/1"
          data-row=""
          trailing={
            <Button size="sm" onClick={onClick}>
              Call
            </Button>
          }
        >
          <span>Dr. Lena Ortiz</span>
          <span className="block text-sm">Cardiology</span>
        </ListRow>
      </List>,
    );
    const link = screen.getByRole("link", { name: /Dr\. Lena Ortiz/ });
    await expect.element(link).toBeVisible();
    expect(screen.getByRole("link").elements()).toHaveLength(1);

    // The link's hit area is the whole row: a point near the row's left edge, outside the text, is the link.
    const row = document.querySelector<HTMLElement>("[data-row]")!.getBoundingClientRect();
    const corner = document.elementFromPoint(row.left + 2, row.top + 2);
    expect(corner?.closest("a")).toBe(link.element());

    await userEvent.click(screen.getByRole("button", { name: "Call" }));
    expect(onClick).toHaveBeenCalledOnce();
    expect(location()).toBe("/");

    await userEvent.click(screen.getByText("Cardiology"));
    await expect.poll(location).toBe("/providers/1");
  });
});
