import { ATTESTATION_TEXT } from "@caretook/data/schema";
import { describe, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import { openAdmin, postedForms } from "../adminWorld";
import * as newGroup from "./route";
import { labelled } from "../../../../test/required";

// /admin/new-group (groups.mjs step 4's group with an owner invite, on
// loader data): the form posts the group, the recipient, the owner's
// address, the attestation and this browser's zone, then names who the
// invitation went to and clears; a refusal shows the field's problem. The
// server's side (no members, staff never join, the `ownerInvite` email with
// its link and no health details, the audit entry) is
// packages/api/src/groups.int.test.ts's, groupsAdmin.int.test.ts's and
// staffAdmin.int.test.ts's.

const fill = async () => {
  await userEvent.fill(page.getByLabelText(labelled("Group name")), "Lindqvist Family");
  await userEvent.fill(page.getByLabelText(labelled("Care recipient's name")), "June Lindqvist");
  await userEvent.fill(page.getByLabelText(labelled("Owner's email")), "pat.lindqvist@example.com");
  await userEvent.click(page.getByRole("checkbox", { name: ATTESTATION_TEXT }));
};

describe("/admin/new-group", () => {
  test("posts the group, its owner's address, the attestation and this browser's zone, then says who was invited", async () => {
    const posted = postedForms(() => ({
      ok: true,
      message: "Created Lindqvist Family. An invitation is on its way to pat.lindqvist@example.com.",
    }));
    await openAdmin({
      routes: {
        path: "/admin/new-group",
        module: newGroup,
        loaderData: null,
        actionResult: posted.actionResult,
      },
      url: "/admin/new-group",
    });
    await fill();
    await userEvent.click(page.getByRole("button", { name: "Create group and invite owner" }));
    await expect
      .element(page.getByRole("status"))
      .toHaveTextContent(
        "Created Lindqvist Family. An invitation is on its way to pat.lindqvist@example.com.",
      );
    expect(posted.posts).toEqual([
      {
        // The runner's zone: CI runs this in more than one.
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        groupName: "Lindqvist Family",
        recipientName: "June Lindqvist",
        ownerEmail: "pat.lindqvist@example.com",
        attested: "on",
      },
    ]);
    // A fresh form for the next family.
    await expect.element(page.getByLabelText(labelled("Group name"))).toHaveValue("");
  });

  test("a refused address shows its problem by the field", async () => {
    await openAdmin({
      routes: {
        path: "/admin/new-group",
        module: newGroup,
        loaderData: null,
        actionResult: {
          ok: false,
          error: "Check the form and try again.",
          issues: [{ path: "ownerEmail", message: "Enter an email address" }],
        },
      },
      url: "/admin/new-group",
    });
    await fill();
    await userEvent.click(page.getByRole("button", { name: "Create group and invite owner" }));
    await expect.element(page.getByText("Enter an email address")).toBeVisible();
    await expect
      .element(page.getByLabelText(labelled("Owner's email")))
      .toHaveValue("pat.lindqvist@example.com");
  });
});
