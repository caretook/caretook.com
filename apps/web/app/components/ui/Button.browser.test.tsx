import { ChevronDown, Pin, Plus } from "lucide-react";
import { useState } from "react";
import { describe, expect, test } from "vitest";
import { userEvent } from "vitest/browser";

import { renderInRouter } from "../../../test/device";
import { buttonClass } from "./buttonClass";
import { Button, IconButton } from "./index";

const classSet = (el: Element) => [...el.classList].sort();

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

  test("with `href` it's a plain anchor the router leaves alone", async () => {
    const { screen } = await renderInRouter(
      <Button href="https://calendar.example.test/add" target="_blank" rel="noreferrer" data-probe="">
        Add to Google
      </Button>,
    );
    const link = screen.getByRole("link", { name: "Add to Google" });
    await expect.element(link).toHaveAttribute("href", "https://calendar.example.test/add");
    await expect.element(link).toHaveAttribute("target", "_blank");
    expect(link.element().classList.contains("btn")).toBe(true);
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

  test("icon only: its label is the accessible name and the tooltip, and the box is square", async () => {
    const { screen } = await renderInRouter(
      <Button icon={Plus} label="Add provider" variant="primary" size="sm" />,
    );
    const button = screen.getByRole("button", { name: "Add provider" });
    await expect.element(button).toHaveAttribute("title", "Add provider");
    await expect.element(button).toHaveTextContent("");
    expect(classSet(button.element())).toEqual(
      buttonClass({ variant: "primary", size: "sm", shape: "square" }).split(" ").sort(),
    );
  });

  test("icon only and round: a circle, still named by its label", async () => {
    const { screen } = await renderInRouter(<Button icon={Plus} label="Add" shape="round" />);
    const button = screen.getByRole("button", { name: "Add" });
    expect(button.element().classList.contains("btn-circle")).toBe(true);
    expect(button.element().classList.contains("btn-square")).toBe(false);
  });

  test("pressed makes a toggle (aria-pressed), on and off", async () => {
    function Toggle() {
      const [on, setOn] = useState(false);
      return <Button icon={Pin} label="Pin" pressed={on} onClick={() => setOn((p) => !p)} />;
    }
    const { screen } = await renderInRouter(<Toggle />);
    const button = screen.getByRole("button", { name: "Pin" });
    await expect.element(button).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(button);
    await expect.element(button).toHaveAttribute("aria-pressed", "true");
  });

  test("a plain button is no toggle and no disclosure", async () => {
    const { screen } = await renderInRouter(<Button>Cancel</Button>);
    const button = screen.getByRole("button", { name: "Cancel" });
    await expect.element(button).not.toHaveAttribute("aria-pressed");
    await expect.element(button).not.toHaveAttribute("aria-expanded");
    await expect.element(button).not.toHaveAttribute("aria-controls");
  });

  test("expanded and controls make a disclosure", async () => {
    const { screen } = await renderInRouter(
      <>
        <Button icon={ChevronDown} label="Show the summary" expanded={false} controls="summary" />
        <Button expanded controls="details">
          Details
        </Button>
        <div id="summary" />
        <div id="details" />
      </>,
    );
    const icon = screen.getByRole("button", { name: "Show the summary" });
    await expect.element(icon).toHaveAttribute("aria-expanded", "false");
    await expect.element(icon).toHaveAttribute("aria-controls", "summary");
    const text = screen.getByRole("button", { name: "Details" });
    await expect.element(text).toHaveAttribute("aria-expanded", "true");
    await expect.element(text).toHaveAttribute("aria-controls", "details");
  });

  test("the `to` and `href` forms look the same as the button form", async () => {
    const look = { variant: "primary", size: "lg", shape: "pill" } as const;
    const { screen } = await renderInRouter(
      <>
        <Button {...look}>As a button</Button>
        <Button {...look} to="/somewhere">
          As a link
        </Button>
        <Button {...look} href="https://example.test/">
          As an anchor
        </Button>
        <Button icon={Plus} label="Icon button" variant="ghost" />
        <Button icon={Plus} label="Icon link" variant="ghost" to="/somewhere" />
        <Button icon={Plus} label="Icon anchor" variant="ghost" href="https://example.test/" />
      </>,
    );
    const button = classSet(screen.getByRole("button", { name: "As a button" }).element());
    expect(button).toEqual(buttonClass(look).split(" ").sort());
    expect(classSet(screen.getByRole("link", { name: "As a link" }).element())).toEqual(button);
    expect(classSet(screen.getByRole("link", { name: "As an anchor" }).element())).toEqual(button);
    const icon = classSet(screen.getByRole("button", { name: "Icon button" }).element());
    const iconLink = screen.getByRole("link", { name: "Icon link" });
    expect(classSet(iconLink.element())).toEqual(icon);
    await expect.element(iconLink).toHaveAttribute("title", "Icon link");
    expect(classSet(screen.getByRole("link", { name: "Icon anchor" }).element())).toEqual(icon);
  });

  test("an IconButton is the icon-only Button: the same element, name and classes", async () => {
    const { screen } = await renderInRouter(
      <>
        <div data-probe="icon">
          <IconButton label="Pin" icon={Pin} pressed onPress={() => undefined} expanded controls="x" />
          <IconButton label="Rows" icon={Plus} onPress={() => undefined} size="md" className="join-item" />
          <IconButton label="Open" icon={Plus} to="/somewhere" />
        </div>
        <div data-probe="button">
          <Button
            label="Pin"
            icon={Pin}
            variant="ghost"
            size="sm"
            pressed
            onClick={() => undefined}
            expanded
            controls="x"
          />
          <Button
            label="Rows"
            icon={Plus}
            variant="ghost"
            size="md"
            onClick={() => undefined}
            className="join-item"
          />
          <Button label="Open" icon={Plus} variant="ghost" size="sm" to="/somewhere" prefetch="render" />
        </div>
      </>,
    );
    const shape = (el: Element) => ({
      tag: el.tagName,
      name: el.getAttribute("aria-label"),
      title: el.getAttribute("title"),
      classes: classSet(el),
      attrs: [...el.attributes]
        .map((a) => `${a.name}=${a.name === "class" ? "" : a.value}`)
        .sort()
        .join(" "),
      icon: el.querySelector("svg")?.getAttribute("class"),
    });
    const rendered = (probe: string) => [...document.querySelector(`[data-probe="${probe}"]`)!.children];
    expect(rendered("icon").map(shape)).toEqual(rendered("button").map(shape));
    await expect
      .element(screen.getByRole("button", { name: "Pin" }).first())
      .toHaveAttribute("aria-pressed", "true");
  });
});
