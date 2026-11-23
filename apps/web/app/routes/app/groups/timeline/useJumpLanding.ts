import type { RefObject } from "react";

import { useEffect, useRef, useState } from "react";
import { NavigationType, useLocation, useNavigationType } from "react-router";
import { isJumpState } from "~/lib/timeline/timelineJump";

/** Room above the landed day, so its heading isn't against the screen's edge. */
const LANDING_GAP = 8;

/**
 * Scroll to the jumped-to day, for a navigation carrying the jump marker (a
 * repeat jump to the same day too) and for a fresh load of a `?day=` URL.
 * Nothing else scrolls: opening or closing a sheet has no marker, and Back
 * (`POP`, marker or not) is scroll restoration's. It runs a frame later, after
 * the router's own scroll handling and with the new window's rows drawn.
 */
export function useJumpLanding(list: RefObject<HTMLElement | null>, jumped: boolean, returning: boolean) {
  const location = useLocation();
  const { key } = location;
  const state: unknown = location.state;
  const navigationType = useNavigationType();
  // A document load has the "default" key; so does Back to it, which `returning` tells apart.
  const [freshKey] = useState(() => (key === "default" && !returning ? key : null));
  const landed = useRef<string | null>(null);

  useEffect(() => {
    const marked = navigationType !== NavigationType.Pop && isJumpState(state);
    const fresh = key === freshKey && landed.current === null;
    if (!jumped || !(marked || fresh) || landed.current === key) return;
    const frame = requestAnimationFrame(() => {
      landed.current = key;
      const target = list.current?.querySelector("[data-jump-notice], section[aria-labelledby^='day-']");
      if (!target) return;
      window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY - LANDING_GAP });
    });
    return () => cancelAnimationFrame(frame);
  }, [key, state, navigationType, jumped, freshKey, list]);
}
