import { afterEach, describe, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import { createRoutesStub } from "react-router";
import * as appLayout from "./app/layout/route";
import * as signIn from "./sign-in";

// B-130: a session check the server rate-limits twice, on a device with
// nobody cached (just signed out, say), goes to sign-in with a message,
// never a silent bounce. The server is a stubbed fetch: get-session always
// answers 429 (no wait before the retry).

const realFetch = window.fetch.bind(window);

afterEach(() => {
  window.fetch = realFetch;
});

const sessionAnswers = (answer: () => Response) => {
  const asked: string[] = [];
  window.fetch = (input, init) => {
    const { pathname } = new URL(new Request(input, init).url);
    if (pathname !== "/api/auth/get-session") return realFetch(input, init);
    asked.push(pathname);
    return Promise.resolve(answer());
  };
  return asked;
};

const tooMany = () =>
  new Response(JSON.stringify({ message: "Too many requests. Please try again later." }), {
    status: 429,
    headers: { "Content-Type": "application/json", "X-Retry-After": "0" },
  });

const open = async (url: string) => {
  const Stub = createRoutesStub([
    {
      id: "app",
      path: "/app",
      middleware: appLayout.clientMiddleware as never,
      Component: () => <p>The app</p>,
    },
    {
      path: "/sign-in",
      loader: signIn.clientLoader as never,
      action: signIn.clientAction as never,
      Component: signIn.default as never,
    },
  ]);
  return render(<Stub initialEntries={[url]} />);
};

describe("a rate-limited session check", () => {
  test("with nobody cached, sign-in says to try again in a moment", async () => {
    localStorage.clear();
    const asked = sessionAnswers(tooMany);
    await open("/app");
    await expect
      .element(page.getByRole("status"))
      .toHaveTextContent("Too many attempts. Try again in a moment.");
    await expect.element(page.getByRole("button", { name: "Sign in" })).toBeVisible();
    // /app asked twice (a retry after the first 429), then sign-in once.
    expect(asked).toHaveLength(3);
  });

  test("a plain sign-in page shows no such message", async () => {
    sessionAnswers(() => Response.json(null));
    await open("/sign-in");
    await expect.element(page.getByRole("button", { name: "Sign in" })).toBeVisible();
    expect(page.getByRole("status").elements()).toHaveLength(0);
  });
});

describe("the email tab", () => {
  test("is labelled Email, and its form has no explanation above it", async () => {
    sessionAnswers(() => Response.json(null));
    await open("/sign-in?with=email");
    const tab = page.getByRole("link", { name: "Email", exact: true });
    await expect.element(tab).toHaveAttribute("aria-current", "page");
    await expect.element(page.getByRole("button", { name: "Send email" })).toBeVisible();
    const form = page.getByRole("button", { name: "Send email" }).element().closest("form")!;
    expect(form.querySelector("p")).toBeNull();
  });
});

describe("the ways to sign in", () => {
  test("two tabs, Password and Email, with the current one marked; Email opens its form", async () => {
    sessionAnswers(() => Response.json(null));
    await open("/sign-in");
    const nav = page.getByRole("navigation", { name: "Ways to sign in" });
    await expect.element(nav.getByRole("link", { name: "Password" })).toHaveAttribute("aria-current", "page");
    await expect
      .element(nav.getByRole("link", { name: "Email", exact: true }))
      .not.toHaveAttribute("aria-current");
    await userEvent.click(nav.getByRole("link", { name: "Email", exact: true }));
    await expect.element(page.getByRole("button", { name: "Send email" })).toBeVisible();
    await expect
      .element(nav.getByRole("link", { name: "Email", exact: true }))
      .toHaveAttribute("aria-current", "page");
  });

  test("switching ways keeps where to go after signing in", async () => {
    sessionAnswers(() => Response.json(null));
    const to = "/app/groups/g-1/planner";
    await open(`/sign-in?redirectTo=${encodeURIComponent(to)}`);
    const nav = page.getByRole("navigation", { name: "Ways to sign in" });
    await userEvent.click(nav.getByRole("link", { name: "Email", exact: true }));
    await expect.element(page.getByRole("button", { name: "Send email" })).toBeVisible();
    const kept = () => document.querySelector<HTMLInputElement>('input[name="redirectTo"]')?.value;
    expect(kept()).toBe(to);
    await userEvent.click(nav.getByRole("link", { name: "Password" }));
    await expect.element(page.getByRole("button", { name: "Sign in" })).toBeVisible();
    expect(kept()).toBe(to);
    await expect.element(nav.getByRole("link", { name: "Password" })).toHaveAttribute("aria-current", "page");
  });

  // The server's 401 for a wrong password (sign-in.mjs's old second test).
  test("a wrong password says so, re-enables the button and stays on sign-in", async () => {
    window.fetch = (input, init) => {
      const { pathname } = new URL(new Request(input, init).url);
      if (pathname === "/api/auth/get-session") return Promise.resolve(Response.json(null));
      if (pathname === "/api/auth/sign-in/email")
        return Promise.resolve(
          Response.json(
            { code: "INVALID_EMAIL_OR_PASSWORD", message: "Invalid email or password" },
            { status: 401 },
          ),
        );
      return realFetch(input, init);
    };
    const { container } = await open("/sign-in");
    await userEvent.fill(page.getByRole("textbox", { name: "Email" }), "pat@example.test");
    await userEvent.fill(page.getByLabelText("Password"), "not-the-password-1234");
    await userEvent.click(page.getByRole("button", { name: "Sign in" }));
    await expect
      .element(page.getByRole("alert"))
      .toHaveTextContent("That email and password don't match an account.");
    await expect.element(page.getByRole("button", { name: "Sign in" })).toBeEnabled();
    expect(container.textContent).not.toContain("The app");
  });

  test("the password form links to Forgot password?", async () => {
    sessionAnswers(() => Response.json(null));
    await open("/sign-in");
    await expect
      .element(page.getByRole("link", { name: "Forgot password?" }))
      .toHaveAttribute("href", "/reset-password");
  });
});

// B-314: offline, Better Auth's fetch rejects with a TypeError. Each request
// says it couldn't reach Caretook in place, never the error page.
describe("offline", () => {
  const OFFLINE = "Couldn't reach Caretook. Check your connection and try again.";

  /** Rejects every auth request but those `answers` names. */
  const offline = (answers: Record<string, () => Response> = {}) => {
    window.fetch = (input, init) => {
      const { pathname } = new URL(new Request(input, init).url);
      if (!pathname.startsWith("/api/auth/")) return realFetch(input, init);
      const answer = answers[pathname];
      return answer ? Promise.resolve(answer()) : Promise.reject(new TypeError("Failed to fetch"));
    };
  };

  const saysOffline = async () => {
    await expect.element(page.getByText(OFFLINE)).toBeVisible();
    expect(document.body.textContent).not.toContain("Unexpected Application Error");
  };

  test("a password sign-in says so and keeps the form", async () => {
    offline();
    await open("/sign-in");
    await userEvent.fill(page.getByRole("textbox", { name: "Email" }), "pat@example.test");
    await userEvent.fill(page.getByLabelText("Password"), "a fictional password");
    await userEvent.click(page.getByRole("button", { name: "Sign in" }));
    await saysOffline();
    await expect.element(page.getByRole("button", { name: "Sign in" })).toBeEnabled();
  });

  test("sending a sign-in email says so and keeps the form", async () => {
    offline();
    await open("/sign-in?with=email");
    await userEvent.fill(page.getByRole("textbox", { name: "Email" }), "pat@example.test");
    await userEvent.click(page.getByRole("button", { name: "Send email" }));
    await saysOffline();
    await expect.element(page.getByRole("button", { name: "Send email" })).toBeEnabled();
  });

  test("a code sign-in says so and keeps the code form", async () => {
    offline({ "/api/auth/sign-in/magic-link": () => Response.json({ status: true }) });
    await open("/sign-in?with=email");
    await userEvent.fill(page.getByRole("textbox", { name: "Email" }), "pat@example.test");
    await userEvent.click(page.getByRole("button", { name: "Send email" }));
    await userEvent.fill(page.getByRole("textbox", { name: "Code" }), "123456");
    await userEvent.click(page.getByRole("button", { name: "Sign in" }));
    await saysOffline();
    await expect.element(page.getByRole("textbox", { name: "Code" })).toBeVisible();
  });
});
