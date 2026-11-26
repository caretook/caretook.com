import type { RefObject } from "react";

import { useEffect, useRef, useState } from "react";
import { NavigationType, useLocation, useNavigationType } from "react-router";
import { isJumpState } from "~/lib/timeline/timelineJump";

/** Room above the landed day, so its heading isn't against the screen's edge. */
export const LANDING_GAP = 8;

/** What the reader does that ends the hold: their own scrolling or a tap or key wins over it. */
const INTENTS = ["wheel", "touchstart", "pointerdown", "keydown"] as const;

/** Where the hold last put the page, while one holds: its scrolls aren't the reader's. */
let heldAt: number | null = null;

/**
 * Whether the page is where the landing's hold put it: a scroll then is the
 * hold's (the cards above settling), not the reader's, so it loads nothing newer.
 */
export const landingHeld = () => heldAt !== null && Math.abs(window.scrollY - heldAt) <= 1;

/**
 * Keep the landed target `LANDING_GAP` from the top while the page around it
 * changes size (the setup, invite or Today card coming in once their queries
 * answer), until the reader scrolls, taps or types. A scroll that isn't the
 * hold's own (the reader's, or a script's) ends it too, so nothing pulls the
 * page back. By measurement, as scroll anchoring isn't reliable on iOS Safari
 * and a bounded window turns it off. Returns the release.
 */
function holdInPlace(target: Element, list: Element | null) {
  let expected = window.scrollY;
  heldAt = expected;
  const pin = () => {
    if (!target.isConnected) return release();
    const off = target.getBoundingClientRect().top - LANDING_GAP;
    if (Math.abs(off) < 1) return;
    window.scrollTo({ top: window.scrollY + off });
    expected = window.scrollY;
    heldAt = expected;
  };
  const onScroll = () => {
    if (Math.abs(window.scrollY - expected) > 1) release();
  };
  const sizes = new ResizeObserver(pin);
  sizes.observe(document.body);
  if (list) sizes.observe(list);
  window.addEventListener("scroll", onScroll, { passive: true });
  for (const type of INTENTS) window.addEventListener(type, release, { passive: true, capture: true });
  function release() {
    heldAt = null;
    sizes.disconnect();
    window.removeEventListener("scroll", onScroll);
    for (const type of INTENTS) window.removeEventListener(type, release, { capture: true });
  }
  return release;
}

/**
 * Scroll to the jumped-to day, for a navigation carrying the jump marker (a
 * repeat jump to the same day too) and for a fresh load of a `?day=` URL.
 * Nothing else scrolls: opening or closing a sheet has no marker, and Back
 * (`POP`, marker or not) is scroll restoration's. It runs a frame later, after
 * the router's own scroll handling and with the new window's rows drawn, and
 * then holds the day there while what's above it settles (`holdInPlace`).
 * Returns whether the landing is over (paging newer waits for it).
 */
export function useJumpLanding(list: RefObject<HTMLElement | null>, jumped: boolean, returning: boolean) {
  const location = useLocation();
  const { key } = location;
  const state: unknown = location.state;
  const navigationType = useNavigationType();
  // A document load has the "default" key; so does Back to it, which `returning` tells apart.
  const [freshKey] = useState(() => (key === "default" && !returning ? key : null));
  const [landedKey, setLandedKey] = useState<string | null>(null);
  const pinned = useRef<Element | null>(null);
  const marked = navigationType !== NavigationType.Pop && isJumpState(state);
  const fresh = key === freshKey && landedKey === null;
  const landing = jumped && (marked || fresh) && landedKey !== key;

  useEffect(() => {
    if (!landing) return;
    const frame = requestAnimationFrame(() => {
      setLandedKey(key);
      const el = list.current;
      const target =
        el?.querySelector("[data-jump-notice]") ?? el?.querySelector("section[aria-labelledby^='day-']");
      if (!target) return;
      window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY - LANDING_GAP });
      pinned.current = target;
    });
    return () => cancelAnimationFrame(frame);
  }, [landing, key, list]);

  // The hold lasts until the reader takes over, or the next landing or leaving the timeline.
  useEffect(() => {
    const target = pinned.current;
    if (landedKey === null || !target) return;
    pinned.current = null;
    return holdInPlace(target, list.current);
  }, [landedKey, list]);

  return !landing;
}
