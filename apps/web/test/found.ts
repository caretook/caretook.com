/**
 * Wait for an element to exist, then return it. Under load a render, a write or a sheet closing hasn't
 * reached the DOM yet when the next line runs, so a test reads through this instead of
 * `X()!.querySelector(…)!`:
 *
 *   await userEvent.click(await found(() => FORM()?.querySelector("[data-add-time]")));
 *   await userEvent.click(await found(PREPARE)); // a getter that returns the element or null
 *
 * The read function may return null, undefined or false for "not there yet" (or throw, which also
 * counts as not there yet). It times out after 5 s, saying what was being waited for.
 */
export async function found<T extends Element>(
  read: () => T | null | undefined | false,
  options: { timeout?: number; message?: string } = {},
): Promise<T> {
  const { timeout = 5000, message } = options;
  const deadline = Date.now() + timeout;
  for (;;) {
    try {
      const el = read();
      if (el) return el;
    } catch {
      // Not there yet.
    }
    if (Date.now() >= deadline) {
      throw new Error(
        `found: no element within ${timeout} ms${message ? `: ${message}` : ""} (${read.toString()}).`,
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}
