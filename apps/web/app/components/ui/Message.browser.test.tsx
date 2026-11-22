import { describe, expect, test } from "vitest";

import { renderInRouter } from "../../../test/device";
import { found } from "../../../test/found";
import { Message } from "./index";

describe("Message", () => {
  test("an error is an alert; success, warning and info are statuses", async () => {
    const { screen } = await renderInRouter(
      <>
        <Message tone="error">Couldn't save.</Message>
        <Message tone="success">Saved.</Message>
        <Message tone="warning">Only you can see this.</Message>
        <Message>Copied.</Message>
      </>,
    );
    await expect.element(screen.getByRole("alert")).toHaveTextContent("Couldn't save.");
    const statuses = screen
      .getByRole("status")
      .elements()
      .map((e) => e.textContent);
    expect(statuses).toEqual(["Saved.", "Only you can see this.", "Copied."]);
  });

  test("an empty message stays mounted and takes no space", async () => {
    const { screen } = await renderInRouter(
      <div data-testid="box">
        <Message tone="error" data-probe="">
          {false}
        </Message>
      </div>,
    );
    const line = await found(() => document.querySelector<HTMLElement>("[data-probe]"));
    expect(line.getAttribute("role")).toBe("alert");
    expect(line.getBoundingClientRect().height).toBe(0);
    expect(screen.getByTestId("box").element().getBoundingClientRect().height).toBe(0);
    await expect.element(screen.getByRole("alert")).not.toBeInTheDocument();
  });
});
