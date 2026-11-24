import { describe, expect, test } from "vitest";
import { KEYBOARD_SHRINK, keyboardOpen } from "./keyboard";

const phone = { textFocused: true, coarse: true, viewportHeight: 450, layoutHeight: 900 };

describe("keyboardOpen", () => {
  test("a focused text field on a coarse pointer with a shrunk viewport", () => {
    expect(keyboardOpen(phone)).toBe(true);
  });

  test("closed with no text field focused, on a fine pointer, or with the viewport near full height", () => {
    expect(keyboardOpen({ ...phone, textFocused: false })).toBe(false);
    expect(keyboardOpen({ ...phone, coarse: false })).toBe(false);
    expect(keyboardOpen({ ...phone, viewportHeight: 900 })).toBe(false);
    // A small shrink (the browser's toolbar) isn't a keyboard.
    expect(keyboardOpen({ ...phone, viewportHeight: 900 * KEYBOARD_SHRINK })).toBe(false);
  });

  test("without visualViewport, the focus alone", () => {
    expect(keyboardOpen({ ...phone, viewportHeight: null })).toBe(true);
    expect(keyboardOpen({ ...phone, viewportHeight: null, textFocused: false })).toBe(false);
    expect(keyboardOpen({ ...phone, viewportHeight: null, coarse: false })).toBe(false);
  });
});
