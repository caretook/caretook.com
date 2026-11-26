import { useRef, useState } from "react";
import { describe, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";

import { renderInRouter } from "../../../test/device";
import { FormTabs, revealField } from "./index";

// FormTabs: the page tabs' look as a tablist whose panels switch in place.
// The look itself (bar, sections, fill, contrast) is TabNav's, tested in
// TabNav.browser.test.tsx.

const tablist = () => page.getByRole("tablist", { name: "Medication sections" });
const tab = (name: string) => tablist().getByRole("tab", { name, exact: false });

function MedicationTabs({ serverIssue = false }: { serverIssue?: boolean }) {
  const form = useRef<HTMLFormElement>(null);
  const [submitted, setSubmitted] = useState<string>("");
  const [issue, setIssue] = useState(false);
  return (
    <form
      ref={form}
      onSubmit={(event) => {
        event.preventDefault();
        setSubmitted(JSON.stringify(Object.fromEntries(new FormData(event.currentTarget))));
      }}
    >
      <FormTabs
        label="Medication sections"
        tabs={[
          {
            id: "essentials",
            label: "Essentials",
            panel: (
              <label>
                Name
                <input name="name" required defaultValue="Ibuprofen" />
              </label>
            ),
          },
          {
            id: "details",
            label: "Details",
            hasContent: true,
            panel: (
              <label>
                Directions
                <input name="directions" aria-invalid={issue || undefined} />
              </label>
            ),
          },
          {
            id: "refills",
            label: "Refills",
            panel: (
              <label>
                Rx number
                <input name="rx" required={!serverIssue} />
              </label>
            ),
          },
        ]}
      />
      <button type="submit">Save</button>
      <button
        type="button"
        onClick={() => {
          setIssue(true);
          // The issue renders first; then the form shows it.
          requestAnimationFrame(() => revealField(form.current));
        }}
      >
        Server says no
      </button>
      <output>{submitted}</output>
    </form>
  );
}

describe("FormTabs", () => {
  test("click and arrow keys switch panels in place; hidden panels stay mounted, keep values and submit", async () => {
    await renderInRouter(<MedicationTabs serverIssue />, { url: "/m/new", width: 320 });
    await expect.element(tab("Essentials")).toHaveAttribute("aria-selected", "true");
    await expect.element(page.getByRole("textbox", { name: "Name" })).toBeVisible();
    // Every panel is in the DOM, the hidden ones hidden.
    expect(document.querySelectorAll('[role="tabpanel"]')).toHaveLength(3);
    await expect
      .element(page.getByRole("textbox", { name: "Rx number", includeHidden: true }))
      .toBeInTheDocument();
    await expect.element(page.getByRole("textbox", { name: "Rx number" })).not.toBeInTheDocument();

    await userEvent.click(tab("Refills"));
    await expect.element(tab("Refills")).toHaveAttribute("aria-selected", "true");
    await userEvent.fill(page.getByRole("textbox", { name: "Rx number" }), "RX-0001");
    expect(location.pathname).toBe("/");

    // Arrow keys move and select, wrapping; only the selected tab is tabbable.
    (tab("Refills").element() as HTMLElement).focus();
    await userEvent.keyboard("{ArrowRight}");
    await expect.element(tab("Essentials")).toHaveAttribute("aria-selected", "true");
    expect(document.activeElement).toBe(tab("Essentials").element());
    await userEvent.keyboard("{ArrowRight}");
    await expect.element(tab("Details")).toHaveAttribute("aria-selected", "true");
    await userEvent.keyboard("{ArrowLeft}");
    await expect.element(tab("Essentials")).toHaveAttribute("aria-selected", "true");
    await userEvent.keyboard("{End}");
    await expect.element(tab("Refills")).toHaveAttribute("aria-selected", "true");
    expect(
      tablist()
        .getByRole("tab")
        .elements()
        .map((t) => t.tabIndex),
    ).toEqual([-1, -1, 0]);
    await userEvent.keyboard("{Home}");
    await expect.element(page.getByRole("textbox", { name: "Rx number" })).not.toBeVisible();

    // The value typed on Refills survived and submits from Essentials.
    await expect
      .element(page.getByRole("textbox", { name: "Rx number", includeHidden: true }))
      .toHaveValue("RX-0001");
    await userEvent.click(page.getByRole("button", { name: "Save" }));
    await expect
      .element(page.getByRole("status"))
      .toHaveTextContent('{"name":"Ibuprofen","directions":"","rx":"RX-0001"}');

    // At 320 the three tabs fit: neither the bar nor the page scrolls sideways.
    const bar = tablist().element();
    expect(bar.scrollWidth).toBeLessThanOrEqual(bar.clientWidth);
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
  });

  test("an invalid field on a hidden panel switches to its tab, focuses it and marks the tab", async () => {
    await renderInRouter(<MedicationTabs />, { url: "/m/new" });
    await expect.element(tab("Essentials")).toHaveAttribute("aria-selected", "true");
    await expect.element(tab("Refills")).not.toHaveAttribute("aria-label");
    await userEvent.click(page.getByRole("button", { name: "Save" }));

    await expect.element(tab("Refills")).toHaveAttribute("aria-selected", "true");
    const rx = page.getByRole("textbox", { name: "Rx number" });
    await expect.element(rx).toBeVisible();
    await expect.element(rx).toHaveFocus();
    await expect.element(tab("Refills")).toHaveAccessibleName("Refills, has an error");
    expect(tab("Refills").element().querySelector('[data-tab-marker="error"]')).not.toBeNull();
    await expect.element(page.getByRole("status")).toHaveTextContent("");

    // Fixing the field clears the marker.
    await userEvent.fill(rx, "RX-0002");
    await expect.element(tab("Refills")).toHaveAccessibleName("Refills");
    expect(tab("Refills").element().querySelector('[data-tab-marker="error"]')).toBeNull();
  });

  test("the content marker shows when told to", async () => {
    await renderInRouter(<MedicationTabs />, { url: "/m/new" });
    await expect.element(tab("Details")).toHaveAccessibleName("Details, filled in");
    expect(tab("Details").element().querySelector('[data-tab-marker="content"]')).not.toBeNull();
    expect(tab("Essentials").element().querySelector("[data-tab-marker]")).toBeNull();
  });

  test("revealField shows a server issue's field: its tab, focus, and the error marker", async () => {
    await renderInRouter(<MedicationTabs serverIssue />, { url: "/m/new" });
    await userEvent.click(page.getByRole("button", { name: "Server says no" }));
    await expect.element(tab("Details")).toHaveAttribute("aria-selected", "true");
    await expect.element(page.getByRole("textbox", { name: "Directions" })).toHaveFocus();
    await expect.element(tab("Details")).toHaveAccessibleName("Details, filled in, has an error");
  });
});
