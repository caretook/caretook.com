import { useState } from "react";
import { describe, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";

import { renderInRouter } from "../../../test/device";
import { defaultChoice } from "~/lib/appointments/repeatChoice";
import { RepeatSheet } from "./RepeatSheet";

// The repeat sheet asks before Close throws away a changed choice (B-603).

const STARTS_ON = "2027-06-09";
const TIMING = {
  startsOn: STARTS_ON,
  startTime: null,
  allDay: true,
  timeZone: "America/Los_Angeles",
  durationMinutes: null,
};

function Harness({ initial = defaultChoice(STARTS_ON) }: { initial?: ReturnType<typeof defaultChoice> }) {
  const [open, setOpen] = useState(true);
  const [done, setDone] = useState("");
  return (
    <>
      <p data-done>{done}</p>
      {open && (
        <RepeatSheet
          initial={initial}
          timing={TIMING}
          kind="event"
          onClose={() => setOpen(false)}
          onDone={(_, rule) => {
            setDone(rule ?? "none");
            setOpen(false);
          }}
        />
      )}
    </>
  );
}

const sheet = () => document.querySelector("[data-repeat-field]");
const asked = () => document.querySelector("dialog[open]") !== null;
const close = () => userEvent.click(page.getByRole("button", { name: "Close" }));
const discard = () => userEvent.click(page.getByRole("button", { name: "Discard" }));
const repeat = () => page.getByRole("combobox", { name: "Repeat" });

describe("the repeat sheet's guard", () => {
  test("a changed choice asks, and Discard closes", async () => {
    await renderInRouter(<Harness />);
    await userEvent.selectOptions(repeat(), "daily");
    await close();
    await expect.poll(asked).toBe(true);
    await discard();
    await expect.poll(sheet).toBeNull();
  });

  test("a weekday chip counts as a change", async () => {
    await renderInRouter(<Harness initial={{ ...defaultChoice(STARTS_ON), preset: "weekly" }} />);
    await userEvent.click(page.getByRole("button", { name: "Mon", exact: true }));
    await close();
    await expect.poll(asked).toBe(true);
  });

  test("an unchanged choice closes without asking", async () => {
    await renderInRouter(<Harness />);
    await close();
    await expect.poll(sheet).toBeNull();
    expect(asked()).toBe(false);
  });

  test("Done keeps a changed choice without asking", async () => {
    await renderInRouter(<Harness />);
    await userEvent.selectOptions(repeat(), "daily");
    await userEvent.click(page.getByRole("button", { name: "Done" }));
    await expect.poll(sheet).toBeNull();
    expect(asked()).toBe(false);
    expect(document.querySelector("[data-done]")?.textContent).toContain("FREQ=DAILY");
  });
});
