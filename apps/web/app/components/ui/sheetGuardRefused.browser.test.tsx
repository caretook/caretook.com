import type { ReactNode } from "react";
import type { PassLogDose } from "~/routes/app/groups/timeline/pass/PassLogForm";

import { useEffect, useLayoutEffect } from "react";
import { createRoutesStub, useLoaderData, useLocation, useNavigate } from "react-router";
import { beforeEach, describe, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";

import { formString } from "~/lib/core/form";
import { PassLogForm } from "~/routes/app/groups/timeline/pass/PassLogForm";
import { found } from "../../../test/found";
import { Sheet } from "./index";

// A refused action that isn't the submitted form's own (B-631): the pass log's
// Add a medication shows its error outside its small form, and a delete runs
// from a confirm. Back must still ask before losing the edits; what succeeded
// still leaves without asking. The real form, over a stub action.

const FIRST = "00000000-0000-4000-8000-000000000001";
const SECOND = "00000000-0000-4000-8000-000000000002";
const REFUSAL = "Fictional refusal.";

const dose = (id: string, medicationId: string, medicationName: string): PassLogDose => ({
  id,
  occurredAt: "2026-03-02T09:00:00.000Z",
  medicationName,
  details: { medicationId, status: "given", amount: "1 tablet" },
});
const CHOICES = [
  { id: "med-a", name: "Fictional A", strength: "5 mg", dose: "1 tablet" },
  { id: "med-b", name: "Fictional B", strength: "5 mg", dose: "1 tablet" },
];

let doses: PassLogDose[] = [];
let refused: ReadonlySet<string> = new Set();
let refusals = 0;

beforeEach(() => {
  doses = [dose(FIRST, "med-a", "Fictional A")];
  refused = new Set();
  refusals = 0;
});

async function stubAction({ request }: { request: Request }) {
  const form = await request.formData();
  const intent = formString(form, "intent");
  if (refused.has(intent)) {
    refusals += 1;
    return { ok: false, error: REFUSAL, issues: [] };
  }
  if (intent === "add") doses = [...doses, dose(SECOND, "med-b", "Fictional B")];
  if (intent === "delete") doses = [];
  return { ok: true };
}

function PassSheet() {
  const { doses: live } = useLoaderData<{ doses: PassLogDose[] }>();
  const navigate = useNavigate();
  const close = () => void navigate("/");
  const gone = live.length === 0;
  useEffect(() => {
    if (gone) void navigate("/");
  }, [gone, navigate]);
  return (
    <>
      <button type="button" hidden data-back onClick={() => void navigate(-1)} />
      <Sheet guardChanges isOpen={!gone} onOpenChange={(open) => !open && close()} title="Edit log">
        <PassLogForm doses={live} choices={CHOICES} onDone={close} onCancel={close} />
      </Sheet>
    </>
  );
}

let where = "";
function Probe({ children }: { children?: ReactNode }) {
  const { pathname } = useLocation();
  useLayoutEffect(() => {
    where = pathname;
  }, [pathname]);
  return children;
}

async function openSheet() {
  const Stub = createRoutesStub([
    { path: "/", Component: () => <Probe /> },
    {
      path: "/sheet",
      Component: () => (
        <Probe>
          <PassSheet />
        </Probe>
      ),
      loader: () => ({ doses }),
      action: stubAction,
      HydrateFallback: () => null,
    },
  ]);
  await render(<Stub initialEntries={["/", "/sheet"]} initialIndex={1} />);
  await expect.element(page.getByRole("dialog", { name: "Edit log" })).toBeVisible();
}

const amount = () => page.elementLocator(document.querySelector(`[name="amount:${FIRST}"]`)!);
const edit = async () => {
  await found(() => document.querySelector(`[name="amount:${FIRST}"]`));
  await userEvent.fill(amount(), "2 tablets");
};
const asked = () => document.querySelector("dialog[open]") !== null;
const pressBack = () => document.querySelector<HTMLElement>("[data-back]")?.click();
const add = () => userEvent.click(page.getByRole("button", { name: "Add", exact: true }));
const deleteLog = async () => {
  await userEvent.click(page.getByRole("button", { name: "Delete this log" }));
  await userEvent.click(page.getByRole("button", { name: "Delete", exact: true }));
};
const refusalShown = () => expect.element(page.getByRole("alert").getByText(REFUSAL)).toBeVisible();

async function backAsksAndKeeps() {
  pressBack();
  await expect.poll(asked).toBe(true);
  await expect.element(page.getByRole("heading", { name: "Discard changes?" })).toBeVisible();
  expect(where).toBe("/sheet");
  await userEvent.click(page.getByRole("button", { name: "Keep editing" }));
  await expect.poll(asked).toBe(false);
  await expect.element(amount()).toHaveValue("2 tablets");
  expect(where).toBe("/sheet");
}

async function backLeaves() {
  pressBack();
  await expect.poll(() => where).toBe("/");
  await expect.poll(() => document.querySelector('[data-sheet="overlay"]')).toBeNull();
  expect(asked()).toBe(false);
}

describe("a refused action outside the submitted form", () => {
  test("Back after a refused Add a medication asks and keeps the edits", async () => {
    refused = new Set(["add"]);
    await openSheet();
    await edit();
    await add();
    await refusalShown();
    await backAsksAndKeeps();
  });

  test("Back after the same Add is refused again still asks", async () => {
    refused = new Set(["add"]);
    await openSheet();
    await edit();
    await add();
    await refusalShown();
    await backAsksAndKeeps();
    await add();
    await expect.poll(() => refusals).toBe(2);
    await expect.element(page.getByRole("button", { name: "Add", exact: true })).toBeEnabled();
    await refusalShown();
    await backAsksAndKeeps();
  });

  test("Back after a delete refused from its confirm asks and keeps the edits", async () => {
    refused = new Set(["delete"]);
    await openSheet();
    await edit();
    await deleteLog();
    await refusalShown();
    await backAsksAndKeeps();
  });
});

describe("what succeeded leaves without asking", () => {
  test("a successful save", async () => {
    await openSheet();
    await edit();
    await userEvent.click(page.getByRole("button", { name: "Save changes" }));
    await expect.poll(() => where).toBe("/");
    await expect.poll(() => document.querySelector('[data-sheet="overlay"]')).toBeNull();
    expect(asked()).toBe(false);
  });

  test("Back after a successful add", async () => {
    await openSheet();
    await add();
    await found(() => document.querySelector(`[data-pass-dose="${SECOND}"]`));
    await backLeaves();
  });

  test("a successful delete", async () => {
    await openSheet();
    await edit();
    await deleteLog();
    await expect.poll(() => where).toBe("/");
    await expect.poll(() => document.querySelector('[data-sheet="overlay"]')).toBeNull();
    expect(asked()).toBe(false);
  });
});
