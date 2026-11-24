import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Linter, RuleTester } from "eslint";
import tseslint from "typescript-eslint";
import { afterAll, describe, expect, it, test } from "vitest";
import { KIT_CLASSES_ALLOWED } from "./kit-guard.mjs";
import plugin, { kitGuard, rules } from "./plugin.mjs";

// The harness's lint rules (plugin.mjs), on TypeScript test snippets.

RuleTester.afterAll = afterAll;
RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

const languageOptions = { parser: tseslint.parser, ecmaVersion: 2024, sourceType: "module" };
const tester = new RuleTester({
  languageOptions: { ...languageOptions, parserOptions: { ecmaFeatures: { jsx: true } } },
});

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
        "caretook/no-call-timeout": "error",
        "caretook/no-non-null-user-event": "error",
        "caretook/no-non-null-in-expect": "error",
        "caretook/no-fixed-sleep": "error",
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
    test(`${rule}: an error, and none under a disable comment with its reason`, () => {
      expect(lint(code)).toEqual([`caretook/${rule}`]);
      expect(
        lint(`// eslint-disable-next-line caretook/${rule} -- the timeout is what's tested\n${code}`),
      ).toEqual([]);
    });
  }
});

const SWEPT = "apps/web/app/routes/app/groups/swept/Screen.tsx";
const kitHit = (code) => ({ code, filename: SWEPT, errors: [{ messageId: "kitClass" }] });
const kitPass = (code) => ({ code, filename: SWEPT });

tester.run("no-kit-classes", rules["no-kit-classes"], {
  valid: [
    // Data and words that only look like a class.
    kitPass('<p role="alert">Saved</p>;'),
    kitPass('const row = { id: "card", title: "Card" };'),
    kitPass('const tone = kind === "alert" ? "error" : "info";'),
    kitPass('<p className={kind === "card" ? "p-2" : "p-4"} />;'),
    kitPass('<p className={names["badge"]} />;'),
    kitPass('<p className={classFor("card")} />;'),
    kitPass('<p className="discard scorecard flashcard" />;'),
    kitPass('const label = "Insurance card on file";'),
    kitPass('const label = "the wallet card";'),
    kitPass("const count = `${n} card`;"),
    kitPass('type Look = "btn-primary" | "card";'),
    kitPass('import x from "card-utils";'),
    // The lists.
    { code: '<a className="btn btn-primary" />;', filename: "apps/web/app/components/ui/Button.tsx" },
    { code: '<a className="btn" />;', filename: "apps/web/app/routes/marketing/home/route.tsx" },
    { code: '<a className="btn" />;', filename: "apps/web/app/routes/dev/ui/sections/CardSection.tsx" },
    {
      code: '<p className="badge" />;',
      filename: "apps/web/app/routes/app/groups/medications/print/MedicationSheet.tsx",
    },
    { code: '<a className="btn" />;', filename: "apps/web/app/routes/admin/access-codes-print/route.tsx" },
  ],
  invalid: [
    // A path that was on the sweep's list until `ui-kit-5` closed it.
    {
      code: '<a className="btn" />;',
      filename: "apps/web/app/routes/app/layout/route.tsx",
      errors: [{ messageId: "kitClass" }],
    },
    kitHit('<a className="btn" />;'),
    kitHit('<p className="card" />;'),
    kitHit('<p className="badge" />;'),
    kitHit('<p className="alert" />;'),
    // Modifiers, with a variant or an important mark.
    kitHit('<a className="mt-2 btn-ghost" />;'),
    kitHit('<a className="sm:btn-sm" />;'),
    kitHit('<a className="has-checked:btn-primary" />;'),
    kitHit('<a className="!btn-primary" />;'),
    kitHit('<p className="card-body" />;'),
    kitHit('<p className="badge-warning" />;'),
    kitHit('<p className="alert-soft" />;'),
    // Templates.
    kitHit("<a className={`btn ${size}`} />;"),
    kitHit("<a className={`btn-${size}`} />;"),
    kitHit("<p className={`card ${extra}`} />;"),
    // Conditionals, arrays, joins.
    kitHit('<a className={on ? "btn" : "link"} />;'),
    kitHit('<p className={on && "badge"} />;'),
    kitHit('<p className={["card", extra].join(" ")} />;'),
    // Constants, object maps, default parameters, a className prop.
    kitHit('const LOOK = "btn btn-sm";'),
    kitHit('const LOOK = "card bg-base-100";'),
    kitHit('const LOOK = "alert shadow";'),
    kitHit('const TONES = { warn: "badge-warning" };'),
    kitHit('function Chip({ look = "btn-xs" }) { return look; }'),
    kitHit('function Box({ className = "card" }) { return className; }'),
    kitHit('const props = { className: "alert" };'),
    // A file on neither list.
    {
      ...kitHit('<a className="btn" />;'),
      filename: "apps/web/app/routes/app/groups/medications/print/week/New.tsx",
    },
  ],
});

describe("the kit's guard", () => {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
  const config = [{ files: ["**/*.{ts,tsx}"], languageOptions }, ...kitGuard];
  const lint = (code, file) =>
    new Linter({ cwd: root }).verify(code, config, resolve(root, file)).map((m) => m.ruleId);
  const OUTSIDE = "apps/web/app/routes/app/groups/swept/screen.ts";
  const INSIDE = "apps/web/app/components/ui/Thing.ts";

  for (const from of [
    "react-aria-components",
    "react-aria",
    "react-stately",
    "@react-aria/focus",
    "@react-stately/overlays",
  ]) {
    test(`${from}: refused outside ui/, allowed inside it`, () => {
      const code = `import { x } from "${from}"; export { x };`;
      expect(lint(code, OUTSIDE)).toEqual(["no-restricted-imports"]);
      expect(lint(code, INSIDE)).toEqual([]);
    });
  }

  test("a type import and a re-export are refused too", () => {
    expect(lint('import type { X } from "react-aria"; export type { X };', OUTSIDE)).toEqual([
      "no-restricted-imports",
    ]);
    expect(lint('export { x } from "react-aria-components";', OUTSIDE)).toEqual(["no-restricted-imports"]);
  });

  test("@internationalized/date passes anywhere", () => {
    expect(lint('import { x } from "@internationalized/date"; export { x };', OUTSIDE)).toEqual([]);
  });

  test("test files are outside the guard", () => {
    const code = 'import { x } from "react-aria"; export const look = ["btn", x];';
    expect(lint(code, "apps/web/app/routes/app/groups/swept/screen.test.ts")).toEqual([]);
  });

  test("every listed path exists", () => {
    const app = (path) => resolve(root, "apps/web/app", path);
    expect(KIT_CLASSES_ALLOWED.filter((p) => !existsSync(app(p)))).toEqual([]);
  });
});
