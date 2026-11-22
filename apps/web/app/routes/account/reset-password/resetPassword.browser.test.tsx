import { afterEach, describe, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import { createRoutesStub } from "react-router";
import * as resetPassword from "./route";

// B-314: offline, Better Auth's fetch rejects with a TypeError. Both requests
// say they couldn't reach Caretook in place, never the error page.

const OFFLINE = "Couldn't reach Caretook. Check your connection and try again.";
const realFetch = window.fetch.bind(window);

afterEach(() => {
  window.fetch = realFetch;
});

const offline = () => {
  window.fetch = (input, init) => {
    const { pathname } = new URL(new Request(input, init).url);
    if (!pathname.startsWith("/api/auth/")) return realFetch(input, init);
    return Promise.reject(new TypeError("Failed to fetch"));
  };
};

const open = (url: string) => {
  const Stub = createRoutesStub([
    {
      path: "/reset-password",
      loader: resetPassword.clientLoader as never,
      action: resetPassword.clientAction as never,
      Component: resetPassword.default as never,
    },
  ]);
  return render(<Stub initialEntries={[url]} />);
};

const saysOffline = async () => {
  await expect.element(page.getByText(OFFLINE)).toBeVisible();
  expect(document.body.textContent).not.toContain("Unexpected Application Error");
};

describe("offline", () => {
  test("asking for a link says so and keeps the form", async () => {
    offline();
    await open("/reset-password");
    await userEvent.fill(page.getByRole("textbox", { name: "Email" }), "pat@example.test");
    await userEvent.click(page.getByRole("button", { name: "Email me a link" }));
    await saysOffline();
    await expect.element(page.getByRole("button", { name: "Email me a link" })).toBeEnabled();
  });

  test("saving a new password says so and keeps the form", async () => {
    offline();
    await open("/reset-password?token=fictional-token");
    await userEvent.fill(page.getByLabelText("New password"), "a fictional new password");
    await userEvent.fill(page.getByLabelText("Type it again"), "a fictional new password");
    await userEvent.click(page.getByRole("button", { name: "Save new password" }));
    await saysOffline();
    await expect.element(page.getByRole("button", { name: "Save new password" })).toBeEnabled();
  });
});
