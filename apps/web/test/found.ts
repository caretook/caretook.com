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

/**
 * Wait until an element has stopped moving: its top edge is the same for about 400 ms. Late content
 * (quick-entry chips, a settling list) pushes the rows down, and a click or hover before that lands
 * on whatever moved into the spot. Resolves once the element has been still, rejects after `timeout`.
 */
export async function stopsMoving(read: () => Element | null | undefined, timeout = 4000): Promise<void> {
  const deadline = Date.now() + timeout;
  let top = -1;
  let still = 0;
  for (;;) {
    let now = -1;
    try {
      now = read()?.getBoundingClientRect().top ?? -1;
    } catch {
      // Not there yet.
    }
    still = now === top ? still + 1 : 0;
    top = now;
    if (still >= 20) return;
    if (Date.now() >= deadline)
      throw new Error(`stopsMoving: still moving after ${timeout} ms (${read.toString()}).`);
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}
