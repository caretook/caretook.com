import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { afterEach, describe, expect, test } from "vitest";
import { cdp, page, userEvent } from "vitest/browser";

import { renderInRouter } from "../../../test/device";
import { found } from "../../../test/found";
import { pickTime } from "../../../test/timeSelect";
import { ChoiceDialog, ConfirmDialog, Sheet, TimeSelect } from "./index";
import { OWN_CHANGE_MS } from "./useSheetChanges";

// A sheet that edits data asks before it throws changes away (B-316): any way
// out but a save or the form's own Cancel, once the form differs from its start.

const overlay = () => document.querySelector<HTMLElement>('[data-sheet="overlay"]');
const panel = () => document.querySelector<HTMLElement>('[data-sheet="panel"]');
const nameField = () => page.getByRole("textbox", { name: "Name" });
const asked = () => document.querySelector("dialog[open]") !== null;
const keep = () => userEvent.click(page.getByRole("button", { name: "Keep editing" }));
const discard = () => userEvent.click(page.getByRole("button", { name: "Discard" }));

/** How Save ends: leaves, closes the way a saved sheet does (Back), or is refused (once). */
type SaveEnd = "leave" | "back" | "refuse" | "refuseField" | "refuseOnce";

function Harness({ saveEnd = "leave" }: { saveEnd?: SaveEnd }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [refused, setRefused] = useState(false);
  // What a sync would do: a new value arriving with no one touching the form.
  const [synced, setSynced] = useState("Fictional start");
  const [deleting, setDeleting] = useState(false);
  const [scoping, setScoping] = useState(false);
  return (
    <>
      <Link to="/sheet">Open the sheet</Link>
      <p data-where>{pathname}</p>
      <button type="button" hidden data-back onClick={() => void navigate(-1)} />
      <button type="button" hidden data-sync onClick={() => setSynced("From another device")} />
      {pathname === "/sheet" && (
        <Sheet guardChanges isOpen onOpenChange={(open) => !open && void navigate("/")} title="Edit">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (
                saveEnd === "refuse" ||
                saveEnd === "refuseField" ||
                (saveEnd === "refuseOnce" && !refused)
              ) {
                // After the submit, as a save's result arrives.
                setTimeout(() => setRefused(true));
                return;
              }
              if (saveEnd === "leave") void navigate("/");
              else void navigate(-1);
            }}
          >
            <label>
              Name{" "}
              <input
                name="name"
                defaultValue="Fictional name"
                aria-invalid={saveEnd === "refuseField" && refused ? true : undefined}
              />
            </label>
            {refused && saveEnd !== "refuseField" && <p role="alert">Couldn't save that.</p>}
            <input type="hidden" name="synced" value={synced} />
            <TimeSelect name="at" label="Time" defaultValue="09:00" />
            <button type="button" data-form-cancel="" onClick={() => void navigate("/")}>
              Cancel
            </button>
            <button type="submit">Save</button>
            <button type="button" onClick={() => setScoping(true)}>
              Save series
            </button>
            <button type="button" onClick={() => setDeleting(true)}>
              Delete
            </button>
          </form>
          <ChoiceDialog
            open={scoping}
            title="Which visits?"
            message="Choose the visits to change."
            cancelLabel="Not now"
            choices={[{ id: "all", label: "All visits", tone: "primary" }]}
            onChoose={() => {
              setScoping(false);
              void navigate("/");
            }}
            onClose={() => setScoping(false)}
          />
          <ConfirmDialog
            open={deleting}
            title="Delete this?"
            confirmLabel="Yes, delete"
            onConfirm={() => {
              setDeleting(false);
              void navigate("/");
            }}
            onClose={() => setDeleting(false)}
          />
        </Sheet>
      )}
    </>
  );
}

const pressBack = () => document.querySelector<HTMLElement>("[data-back]")?.click();

async function openSheet(saveEnd?: SaveEnd) {
  const view = await renderInRouter(<Harness saveEnd={saveEnd} />, { width: 800 });
  const opener = view.screen.getByRole("link", { name: "Open the sheet" });
  await userEvent.click(opener);
  await expect.element(page.getByRole("dialog", { name: "Edit" })).toBeVisible();
  await expect.poll(() => getComputedStyle(overlay()!).opacity).toBe("1");
  return { ...view, opener };
}

const WAYS = [
  { way: "Close", act: () => userEvent.click(page.getByRole("button", { name: "Close" })) },
  { way: "Escape", act: () => userEvent.keyboard("{Escape}") },
  {
    way: "a tap outside",
    act: async () =>
      userEvent.click(page.elementLocator(await found(() => overlay())), { position: { x: 4, y: 4 } }),
  },
  { way: "Back", act: () => Promise.resolve(pressBack()) },
] as const;

describe.each(WAYS)("$way", ({ act }) => {
  test("a changed form asks; Keep editing keeps the values, Discard closes", async () => {
    const { location } = await openSheet();
    await userEvent.fill(nameField(), "Changed");
    await act();
    await expect.poll(asked).toBe(true);
    await expect.element(page.getByRole("heading", { name: "Discard changes?" })).toBeVisible();
    expect(location()).toBe("/sheet");

    await keep();
    await expect.poll(asked).toBe(false);
    await expect.element(nameField()).toHaveValue("Changed");
    expect(location()).toBe("/sheet");

    await act();
    await expect.poll(asked).toBe(true);
    await discard();
    await expect.poll(location).toBe("/");
    await expect.poll(overlay).toBeNull();
  });

  test("an unchanged form closes without asking", async () => {
    const { location } = await openSheet();
    await act();
    await expect.poll(location).toBe("/");
    await expect.poll(overlay).toBeNull();
  });
});

describe("what counts as a change", () => {
  test("a change through TimeSelect asks", async () => {
    await openSheet();
    await pickTime(() => panel()?.querySelector<HTMLInputElement>("[name=at]"), "10:00");
    await userEvent.keyboard("{Escape}");
    await expect.poll(asked).toBe(true);
  });

  test("typing a value back to its start is no change", async () => {
    const { location } = await openSheet();
    await userEvent.fill(nameField(), "Changed");
    await userEvent.fill(nameField(), "Fictional name");
    await userEvent.keyboard("{Escape}");
    await expect.poll(location).toBe("/");
  });

  test("a value a sync put there before the first touch is no change", async () => {
    const { location } = await openSheet();
    document.querySelector<HTMLElement>("[data-sync]")?.click();
    await expect
      .poll(() => panel()?.querySelector<HTMLInputElement>("[name=synced]")?.value)
      .toBe("From another device");
    await userEvent.keyboard("{Escape}");
    await expect.poll(location).toBe("/");
  });
});

describe("leaving on purpose", () => {
  test("saving a changed form closes without asking", async () => {
    const { location } = await openSheet();
    await userEvent.fill(nameField(), "Changed");
    await userEvent.click(page.getByRole("button", { name: "Save" }));
    await expect.poll(location).toBe("/");
    await expect.poll(overlay).toBeNull();
    expect(asked()).toBe(false);
  });

  test("a confirmed delete closes a changed form without asking again", async () => {
    const { location } = await openSheet();
    await userEvent.fill(nameField(), "Changed");
    await userEvent.click(page.getByRole("button", { name: "Delete" }));
    await userEvent.click(page.getByRole("button", { name: "Yes, delete" }));
    await expect.poll(location).toBe("/");
    await expect.poll(overlay).toBeNull();
    expect(asked()).toBe(false);
  });

  test("a choice that saves closes a changed form without asking", async () => {
    const { location } = await openSheet();
    await userEvent.fill(nameField(), "Changed");
    await userEvent.click(page.getByRole("button", { name: "Save series" }));
    await userEvent.click(page.getByRole("button", { name: "All visits" }));
    await expect.poll(location).toBe("/");
    await expect.poll(overlay).toBeNull();
    expect(asked()).toBe(false);
  });

  test("the form's own Cancel closes without asking", async () => {
    const { location } = await openSheet();
    await userEvent.fill(nameField(), "Changed");
    await userEvent.click(page.getByRole("button", { name: "Cancel" }));
    await expect.poll(location).toBe("/");
    expect(asked()).toBe(false);
  });
});

describe("after a save (B-601)", () => {
  const save = () => userEvent.click(page.getByRole("button", { name: "Save", exact: true }));

  test.each([
    { how: "an error line", saveEnd: "refuse", shown: () => panel()?.querySelector('[role="alert"]') },
    {
      how: "a marked field",
      saveEnd: "refuseField",
      shown: () => panel()?.querySelector('[aria-invalid="true"]'),
    },
  ] as const)("Back after a save refused with $how asks and keeps the edits", async ({ saveEnd, shown }) => {
    const { location } = await openSheet(saveEnd);
    await userEvent.fill(nameField(), "Changed");
    await save();
    await found(shown);
    pressBack();
    await expect.poll(asked).toBe(true);
    expect(location()).toBe("/sheet");
    await keep();
    await expect.element(nameField()).toHaveValue("Changed");
    expect(location()).toBe("/sheet");
  });

  test("Back after a successful save closes without asking", async () => {
    const { location } = await openSheet("back");
    await userEvent.fill(nameField(), "Changed");
    await save();
    await expect.poll(location).toBe("/");
    await expect.poll(overlay).toBeNull();
    expect(asked()).toBe(false);
  });

  test("a save that succeeds after a refusal closes without asking", async () => {
    const { location } = await openSheet("refuseOnce");
    await userEvent.fill(nameField(), "Changed");
    await save();
    await found(() => panel()?.querySelector('[role="alert"]'));
    await save();
    await expect.poll(location).toBe("/");
    await expect.poll(overlay).toBeNull();
    expect(asked()).toBe(false);
  });
});

test("after Discard the exit still plays and focus returns to the opener", async () => {
  const { opener } = await openSheet();
  await userEvent.fill(nameField(), "Changed");
  await userEvent.keyboard("{Escape}");
  await expect.poll(asked).toBe(true);
  let exited = false;
  const observer = new MutationObserver(() => {
    if (overlay()?.hasAttribute("data-closing")) exited = true;
  });
  observer.observe(document.body, { subtree: true, attributes: true, attributeFilter: ["data-closing"] });
  await discard();
  await expect.poll(overlay).toBeNull();
  observer.disconnect();
  expect(exited).toBe(true);
  await expect.poll(() => document.activeElement).toBe(opener.element());
});

describe("only the person's own changes ask (B-602)", () => {
  const syncArrives = async () => {
    // Past the touch, so what arrives can't be its result.
    // eslint-disable-next-line caretook/no-fixed-sleep -- the hook's window is time itself
    await new Promise((resolve) => setTimeout(resolve, OWN_CHANGE_MS + 100));
    document.querySelector<HTMLElement>("[data-sync]")?.click();
    await expect
      .poll(() => panel()?.querySelector<HTMLInputElement>("[name=synced]")?.value)
      .toBe("From another device");
  };

  test("a sync after the first touch is no change", async () => {
    const { location } = await openSheet();
    await userEvent.click(nameField());
    await syncArrives();
    await userEvent.keyboard("{Escape}");
    await expect.poll(location).toBe("/");
    expect(asked()).toBe(false);
  });

  test("the person's own change still asks after a sync", async () => {
    const { location } = await openSheet();
    await userEvent.fill(nameField(), "Changed");
    await syncArrives();
    await userEvent.keyboard("{Escape}");
    await expect.poll(asked).toBe(true);
    expect(location()).toBe("/sheet");
  });

  test("a change through TimeSelect still asks after a sync", async () => {
    await openSheet();
    await pickTime(() => panel()?.querySelector<HTMLInputElement>("[name=at]"), "10:00");
    await syncArrives();
    await userEvent.keyboard("{Escape}");
    await expect.poll(asked).toBe(true);
  });
});

describe("a sheet on top of a changed one (B-602)", () => {
  function Stacked() {
    const { pathname } = useLocation();
    const navigate = useNavigate();
    const [more, setMore] = useState(false);
    return (
      <>
        <Link to="/sheet">Open the sheet</Link>
        <button type="button" hidden data-back onClick={() => void navigate(-1)} />
        {pathname === "/sheet" && (
          <Sheet guardChanges isOpen onOpenChange={(open) => !open && void navigate("/")} title="Edit">
            <label>
              Name <input name="name" defaultValue="Fictional name" />
            </label>
            <button type="button" onClick={() => setMore(true)}>
              More
            </button>
            <Sheet isOpen={more} onOpenChange={setMore} title="More">
              <p>Fictional details</p>
            </Sheet>
          </Sheet>
        )}
      </>
    );
  }

  async function openStacked() {
    const view = await renderInRouter(<Stacked />, { width: 800 });
    await userEvent.click(view.screen.getByRole("link", { name: "Open the sheet" }));
    await userEvent.fill(nameField(), "Changed");
    await userEvent.click(page.getByRole("button", { name: "More" }));
    await expect.element(page.getByRole("dialog", { name: "More" })).toBeVisible();
    return view;
  }

  test("Back asks; Keep editing keeps both, Discard leaves", async () => {
    const { location } = await openStacked();
    pressBack();
    await expect.poll(asked).toBe(true);
    expect(location()).toBe("/sheet");
    await keep();
    await expect.poll(asked).toBe(false);
    expect(location()).toBe("/sheet");
    pressBack();
    await expect.poll(asked).toBe(true);
    await discard();
    await expect.poll(location).toBe("/");
    await expect.poll(overlay).toBeNull();
  });

  test("Escape closes only the top sheet, without asking", async () => {
    const { location } = await openStacked();
    await userEvent.keyboard("{Escape}");
    await expect.poll(() => document.querySelectorAll('[data-sheet="panel"]').length).toBe(1);
    expect(asked()).toBe(false);
    expect(location()).toBe("/sheet");
    await expect.element(nameField()).toHaveValue("Changed");
  });
});

describe("under reduced motion (B-602)", () => {
  const devtools = () => cdp() as unknown as { send: (method: string, params: object) => Promise<unknown> };
  afterEach(async () => {
    await devtools().send("Emulation.setEmulatedMedia", { features: [] });
  });

  function StaysMounted() {
    const [open, setOpen] = useState(false);
    return (
      <>
        <button type="button" onClick={() => setOpen(true)}>
          Open it
        </button>
        <Sheet guardChanges isOpen={open} onOpenChange={setOpen} title="Edit">
          <label>
            Name <input name="name" defaultValue="Fictional name" />
          </label>
        </Sheet>
      </>
    );
  }

  test("a sheet that stays mounted asks again after a Discard", async () => {
    await devtools().send("Emulation.setEmulatedMedia", {
      features: [{ name: "prefers-reduced-motion", value: "reduce" }],
    });
    const view = await renderInRouter(<StaysMounted />, { width: 800 });
    const change = async () => {
      await userEvent.click(view.screen.getByRole("button", { name: "Open it" }));
      await userEvent.fill(nameField(), "Changed");
      await userEvent.keyboard("{Escape}");
      await expect.poll(asked).toBe(true);
    };
    await change();
    await discard();
    await expect.poll(overlay).toBeNull();
    await change();
  });
});
