// After sign-out, does the device's local copy (the IndexedDB behind local
// SQLite) still hold care data? It checks what search keeps on the device: the
// search index (its tables live outside PowerSync's, so `dropSearchTables`
// must run before the wipe) and the user's recent searches (localStorage) are
// gone after sign-out.
import { expect, localCopyHolds, signIn, signOut, test, waitFor } from "./fixtures.mjs";

const recentKeys = () => Object.keys(localStorage).filter((k) => k.startsWith("caretook:recentSearches:"));

test(
  "sign-out clears the recent searches and drops the search index",
  { tag: "@smoke" },
  async ({ device }) => {
    const { page } = await device("member");
    await signIn(page, "member@example.com");
    await expect(page.locator("ol > li").first()).toBeVisible({ timeout: 30_000 });

    // A search used on the search page (submitted), and the index built.
    const groupPath = new URL(page.url()).pathname.replace(/\/timeline$/, "");
    await page.goto(`${groupPath}/search`);
    const field = page.locator("[data-search-page] [data-search-field]");
    await field.fill("lisinopril");
    await field.evaluate((el) => el.form.requestSubmit());
    await waitFor(
      page,
      () => Object.keys(localStorage).some((k) => k.startsWith("caretook:recentSearches:")),
      {
        timeout: 5000,
      },
    ).catch(() => undefined);
    await page.evaluate(async () => {
      const { search } = await window.caretookModules();
      await search.searchIndexSettled();
      return true;
    });

    await test.step("a used search is saved for its user", async () => {
      expect(await page.evaluate(recentKeys)).not.toEqual([]);
    });
    await test.step("the search index is in the local copy while signed in", async () => {
      expect(await localCopyHolds(page, "search_fts")).toBe("holds it");
    });

    await signOut(page);
    await page.waitForURL((url) => url.pathname === "/sign-in", { timeout: 15_000 });

    await test.step("sign-out clears the recent searches", async () => {
      await expect.poll(() => page.evaluate(recentKeys)).toEqual([]);
    });
    await test.step("sign-out drops the search index (no search table left in the file)", async () => {
      await expect
        .poll(async () => ["clean", "no file"].includes(await localCopyHolds(page, "search_fts")), {
          message: "the search index is gone from the local copy",
        })
        .toBe(true);
    });
  },
);
