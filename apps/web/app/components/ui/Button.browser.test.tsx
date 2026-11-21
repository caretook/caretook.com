import { Plus } from "lucide-react";
import { useState } from "react";
import { describe, expect, test } from "vitest";
import { userEvent } from "vitest/browser";

import { renderInRouter } from "../../../test/device";
import { Button } from "./index";

describe("Button", () => {
  test("busy disables it and shows the busy label", async () => {
    const { screen } = await renderInRouter(
      <Button variant="primary" busy busyLabel="Saving…">
        Save
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Saving…" });
    await expect.element(button).toBeDisabled();
    await expect.element(screen.getByRole("button", { name: "Save" })).not.toBeInTheDocument();
  });

  test("busy without a busy label keeps its text", async () => {
    const { screen } = await renderInRouter(<Button busy>Decline</Button>);
    await expect.element(screen.getByRole("button", { name: "Decline" })).toBeDisabled();
  });

  test("is a plain button by default, so it never submits a form by itself", async () => {
    let submits = 0;
    const { screen } = await renderInRouter(
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submits++;
        }}
      >
        <Button icon={Plus}>Add</Button>
      </form>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(submits).toBe(0);
  });

  test("with `to` it's a link to that place", async () => {
    const { screen, location } = await renderInRouter(
      <Button to="/somewhere?x=1" variant="primary">
        Continue
      </Button>,
    );
    const link = screen.getByRole("link", { name: "Continue" });
    await expect.element(link).toHaveAttribute("href", "/somewhere?x=1");
    await userEvent.click(link);
    await expect.poll(location).toBe("/somewhere?x=1");
  });

  test("a submit Button submits its form once, however quickly it's tapped", async () => {
    let submits = 0;
    function Form() {
      const [busy, setBusy] = useState(false);
      return (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submits++;
            setBusy(true);
          }}
        >
          <Button type="submit" variant="primary" busy={busy} busyLabel="Saving…">
            Save
          </Button>
        </form>
      );
    }
    const { screen } = await renderInRouter(<Form />);
    await userEvent.dblClick(screen.getByRole("button", { name: "Save" }));
    await expect.element(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Saving…" }), { force: true });
    expect(submits).toBe(1);
  });

  test("danger and quiet danger are both buttons with their name", async () => {
    const { screen } = await renderInRouter(
      <>
        <Button variant="danger">Delete</Button>
        <Button variant="dangerQuiet">Remove</Button>
      </>,
    );
    await expect.element(screen.getByRole("button", { name: "Delete" })).toBeEnabled();
    await expect.element(screen.getByRole("button", { name: "Remove" })).toBeEnabled();
  });
});
