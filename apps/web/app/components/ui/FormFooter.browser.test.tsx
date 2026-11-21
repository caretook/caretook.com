import type { FormEvent, ReactNode } from "react";

import { describe, expect, test, vi } from "vitest";
import { userEvent } from "vitest/browser";

import { renderInRouter } from "../../../test/device";
import { FormFooter } from "./index";

const inForm = (footer: ReactNode) => <form onSubmit={(e) => e.preventDefault()}>{footer}</form>;

describe("FormFooter", () => {
  test("Cancel comes before the submit button", async () => {
    const { screen } = await renderInRouter(
      inForm(<FormFooter submitLabel="Save" cancel={{ label: "Cancel", to: "/back" }} />),
    );
    const cancel = screen.getByRole("link", { name: "Cancel" }).element();
    const save = screen.getByRole("button", { name: "Save" }).element();
    expect(cancel.compareDocumentPosition(save) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    await expect.element(screen.getByRole("button", { name: "Save" })).toHaveAttribute("type", "submit");
  });

  test("Cancel as a link navigates", async () => {
    const { screen, location } = await renderInRouter(
      inForm(<FormFooter submitLabel="Save" cancel={{ label: "Cancel", to: "/back" }} />),
      { url: "/form" },
    );
    await userEvent.click(screen.getByRole("link", { name: "Cancel" }));
    await expect.poll(location).toBe("/back");
  });

  test("Cancel as a callback calls it, and doesn't submit", async () => {
    const onCancel = vi.fn();
    const onSubmit = vi.fn((e: FormEvent) => e.preventDefault());
    const { screen } = await renderInRouter(
      <form onSubmit={onSubmit}>
        <FormFooter submitLabel="Save" cancel={{ label: "Cancel", onCancel }} />
      </form>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledOnce();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  test("busy disables the submit button and relabels it", async () => {
    const { screen } = await renderInRouter(
      inForm(<FormFooter submitLabel="Save" busy busyLabel="Saving…" />),
    );
    await expect.element(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();
  });

  test("the status slot renders, start-aligned or not", async () => {
    const { screen } = await renderInRouter(
      <>
        {inForm(<FormFooter align="start" submitLabel="Save" status={<p role="status">Saved.</p>} />)}
        {inForm(<FormFooter submitLabel="Send" status={<p role="alert">Couldn't send.</p>} />)}
      </>,
    );
    await expect.element(screen.getByRole("status")).toHaveTextContent("Saved.");
    await expect.element(screen.getByRole("alert")).toHaveTextContent("Couldn't send.");
  });
});
