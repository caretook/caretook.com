import { Linter, RuleTester } from "eslint";
import tseslint from "typescript-eslint";
import { afterAll, describe, expect, it, test } from "vitest";
import plugin, { rules } from "./plugin.mjs";

// The harness's lint rules (plugin.mjs), on TypeScript test snippets.

RuleTester.afterAll = afterAll;
RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

const languageOptions = { parser: tseslint.parser, ecmaVersion: 2024, sourceType: "module" };
const tester = new RuleTester({ languageOptions });

tester.run("no-call-timeout", rules["no-call-timeout"], {
  valid: [
    "await found(() => document.querySelector('[data-row]'));",
    "await found(() => row(), { message: 'the row' });",
    "await waitUntil(() => saved, 'the save');",
    "await stopsMoving(() => row());",
    "await expect.poll(() => count()).toBe(2);",
    "await expect.element(screen.getByText('Saved')).toBeVisible();",
    // Look-alikes: a timeout on a network helper, on settle, on a test.
    "await fetchWithRetry('/rpc/entries', { timeout: 3000 });",
    "await device.settle({ timeout: 300 });",
    "test('slow', async () => {}, { timeout: 20_000 });",
    "await page.waitFor(() => ready(), 500);",
  ],
  invalid: [
    { code: "await found(() => row(), { timeout: 10_000 });", errors: [{ messageId: "timeout" }] },
    { code: "await found(() => row(), { message: 'x', timeout });", errors: [{ messageId: "timeout" }] },
    { code: "await waitUntil(() => saved, { timeout: 2000 });", errors: [{ messageId: "timeout" }] },
    { code: "await waitUntil(() => saved, 2000);", errors: [{ messageId: "timeout" }] },
    { code: "await stopsMoving(() => row(), 1000);", errors: [{ messageId: "timeout" }] },
    { code: "await stopsMoving(() => row(), LONG);", errors: [{ messageId: "timeout" }] },
    {
      code: "await expect.poll(() => count(), { timeout: 15_000 }).toBe(2);",
      errors: [{ messageId: "timeout" }],
    },
    {
      code: "await expect.element(screen.getByText('Saved'), { timeout: 8 * 1000 }).toBeVisible();",
      errors: [{ messageId: "timeout" }],
    },
  ],
});

tester.run("no-non-null-user-event", rules["no-non-null-user-event"], {
  valid: [
    "await userEvent.click(screen.getByRole('button', { name: 'Save' }));",
    "await userEvent.click(await found(() => form()?.querySelector('[data-add]')));",
    // A `!` inside the read that found retries is only "not yet".
    "await userEvent.click(await found(() => form()!.querySelector('[data-add]')));",
    // Look-alikes: `!` outside the call, logical not.
    "const button = form()!.querySelector('button')!; await userEvent.click(button);",
    "await userEvent.keyboard(!shift ? '{Enter}' : '{Shift>}{Enter}{/Shift}');",
    "await other.click(row()!);",
  ],
  invalid: [
    { code: "await userEvent.click(row()!);", errors: [{ messageId: "nonNull" }] },
    {
      code: "await userEvent.click(form()!.querySelector('[data-add]') as HTMLElement);",
      errors: [{ messageId: "nonNull" }],
    },
    {
      code: "await userEvent.fill(input!, 'Booked a ride');",
      errors: [{ messageId: "nonNull" }],
    },
    {
      code: "await userEvent.hover(document.querySelector<HTMLElement>('[data-author]')!);",
      errors: [{ messageId: "nonNull" }],
    },
  ],
});

tester.run("no-non-null-in-expect", rules["no-non-null-in-expect"], {
  valid: [
    "expect(row()?.textContent).toBe('Ate lunch');",
    "await expect.element(screen.getByText('Ate lunch')).toBeVisible();",
    "await expect.poll(() => row()!.textContent).toBe('Ate lunch');",
    // Look-alikes: `!` outside expect, logical not.
    "const text = row()!.textContent; expect(text).toBe('Ate lunch');",
    "expect(!dialog.open).toBe(true);",
    "assert(row()!);",
  ],
  invalid: [
    { code: "expect(row()!.textContent).toBe('Ate lunch');", errors: [{ messageId: "nonNull" }] },
    { code: "expect(items[0]!).toBeDefined();", errors: [{ messageId: "nonNull" }] },
    { code: "expect.soft(row()!.dataset.day).toBe('2027-06-09');", errors: [{ messageId: "nonNull" }] },
    {
      code: "await expect.element(page.elementLocator(row()!)).toBeVisible();",
      errors: [{ messageId: "nonNull" }],
    },
  ],
});

tester.run("no-fixed-sleep", rules["no-fixed-sleep"], {
  valid: [
    // Look-alikes: a frame, a timer that isn't awaited, a wait on the thing.
    "await new Promise((resolve) => requestAnimationFrame(resolve));",
    "setTimeout(() => host.append(button), 150);",
    "await waitUntil(() => saved);",
    "await device.settle();",
    "await wait();",
    // A helper of the same name that waits on the thing.
    "await wait(LINKED.id, () => bandNames().includes('Linked to'));",
    "await wait(MINE.id);",
    "const timer = setTimeout(done, 100); clearTimeout(timer);",
  ],
  invalid: [
    { code: "await new Promise((r) => setTimeout(r, 300));", errors: [{ messageId: "sleep" }] },
    {
      code: "await new Promise(function (resolve) { setTimeout(resolve, 50); });",
      errors: [{ messageId: "sleep" }],
    },
    {
      code: "const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));",
      errors: [{ messageId: "sleep" }],
    },
    { code: "await sleep(200);", errors: [{ messageId: "sleep" }] },
    { code: "await wait(500);", errors: [{ messageId: "sleep" }] },
    { code: "await delay(100);", errors: [{ messageId: "sleep" }] },
    { code: "await pause(2 * 150);", errors: [{ messageId: "sleep" }] },
    { code: "await setTimeout(100);", errors: [{ messageId: "sleep" }] },
  ],
});

describe("the disable comment", () => {
  const config = [
    {
      files: ["**/*.tsx"],
      languageOptions,
      plugins: { caretook: plugin },
      rules: {
        "caretook/no-call-timeout": "warn",
        "caretook/no-non-null-user-event": "warn",
        "caretook/no-non-null-in-expect": "warn",
        "caretook/no-fixed-sleep": "warn",
      },
    },
  ];
  const lint = (code) => new Linter().verify(code, config, "x.browser.test.tsx").map((m) => m.ruleId);

  const cases = {
    "no-call-timeout": "await found(() => row(), { timeout: 100 });",
    "no-non-null-user-event": "await userEvent.click(row()!);",
    "no-non-null-in-expect": "expect(row()!.textContent).toBe('x');",
    "no-fixed-sleep": "await new Promise((r) => setTimeout(r, 300));",
  };

  for (const [rule, code] of Object.entries(cases)) {
    test(`${rule}: a warning, and none under a disable comment with its reason`, () => {
      expect(lint(code)).toEqual([`caretook/${rule}`]);
      expect(
        lint(`// eslint-disable-next-line caretook/${rule} -- the timeout is what's tested\n${code}`),
      ).toEqual([]);
    });
  }
});
