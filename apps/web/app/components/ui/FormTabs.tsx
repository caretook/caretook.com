import type { KeyboardEvent, ReactNode } from "react";
import type { Accent } from "./accents";
import type { TabParts } from "./tabLook";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { keepTabInView, TAB_BAR, TabContent, tabClass, tabName } from "./tabLook";

export type FormTab = TabParts & {
  /** Stable and unique among the tabs (it keys the tab and its panel). */
  id: string;
  /** The tab's fields. Every panel stays mounted: a hidden one keeps its values and submits them. */
  panel: ReactNode;
};

/** The event `revealField` sends to the field; `FormTabs` answers it by showing the field's panel. */
const REVEAL = "caretook:reveal-field";
const PANEL = "data-form-tab-panel";

const fieldIn = (scope: ParentNode, field: string | Element | undefined) => {
  if (field instanceof Element) return field;
  if (field === undefined) return scope.querySelector('[aria-invalid="true"]');
  return scope.querySelector(`[name="${CSS.escape(field)}"]`) ?? scope.querySelector(`#${CSS.escape(field)}`);
};

/**
 * Shows a field and focuses it, switching any `FormTabs` holding it to its
 * panel: for a server's issues, once their errors render. `field` is a field's
 * `name` (else an `id`), the element itself, or left out for the first field
 * marked `aria-invalid="true"` (what `Field` sets while it has an error).
 * `scope` is where to look (the form). Returns the field, or null when none
 * is found. Works the same on a form without tabs.
 */
export function revealField(scope: ParentNode | null | undefined, field?: string | Element) {
  const el = scope ? fieldIn(scope, field) : null;
  if (!(el instanceof HTMLElement)) return null;
  el.dispatchEvent(new Event(REVEAL, { bubbles: true }));
  el.focus();
  return el;
}

const invalidPanels = (root: HTMLElement) =>
  new Set(
    [...root.querySelectorAll<HTMLElement>(`[${PANEL}]`)]
      .filter((panel) => panel.querySelector('[aria-invalid="true"]'))
      .map((panel) => panel.getAttribute(PANEL)!),
  );

const same = (a: Set<string>, b: Set<string>) => a.size === b.size && [...a].every((id) => b.has(id));

/**
 * A form's tabs: the page tabs' look (`TabNav`'s bar, sections and current
 * fill, `tabLook.tsx`) as an ARIA tablist whose panels switch in place, with
 * no navigation. Arrow keys (and Home, End) move between the tabs and select
 * as they go; only the selected tab is in the Tab order.
 *
 * Every panel stays mounted (hidden ones get `hidden`), so values survive a
 * switch, a hidden field still submits, and a form's discard check counts it.
 * Opens on the first tab (or `defaultTab`).
 *
 * Errors move to their field: a native `invalid` event (a submit, or
 * `reportValidity`) on a hidden panel's field switches to that panel (the
 * first one in the form's order) and focuses the field; for a server's issues,
 * call `revealField(form)` once they render. A tab shows its error marker
 * while its panel holds a field that failed native validation (until each is
 * fixed) or one marked `aria-invalid="true"`, or when its `error` says so; its
 * content marker when `hasContent` says so (a caller's own rule, such as "a
 * saved value is on this tab"). `accent` tints the current tab and counts;
 * `className` is for the outer element only.
 */
export function FormTabs({
  label,
  tabs,
  defaultTab,
  accent,
  className = "",
}: {
  /** The tablist's name ("Medication sections"). */
  label: string;
  tabs: readonly FormTab[];
  defaultTab?: string;
  accent?: Accent;
  className?: string;
}) {
  const base = useId();
  const root = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  const [selectedId, setSelectedId] = useState(defaultTab ?? tabs[0]?.id);
  const index = Math.max(
    0,
    tabs.findIndex((tab) => tab.id === selectedId),
  );
  const selected = tabs[index]?.id;
  const selectedRef = useRef(selected);
  useLayoutEffect(() => {
    selectedRef.current = selected;
  }, [selected]);
  // Panels with a field that failed native validation, and with one marked aria-invalid.
  const [nativeErrors, setNativeErrors] = useState<ReadonlySet<string>>(new Set());
  const [markedErrors, setMarkedErrors] = useState<Set<string>>(new Set());
  useLayoutEffect(() => keepTabInView(bar.current, index), [index]);

  const tabId = (id: string) => `${base}-tab-${id}`;
  const panelId = (id: string) => `${base}-panel-${id}`;

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const panelOf = (target: EventTarget | null) =>
      target instanceof Element ? target.closest(`[${PANEL}]`)?.getAttribute(PANEL) : undefined;
    const show = (id: string) => {
      if (id !== selectedRef.current) flushSync(() => setSelectedId(id));
    };

    // One submit fires `invalid` on every bad field in order: the first one picks the panel.
    let round = false;
    const onInvalid = (event: Event) => {
      const id = panelOf(event.target);
      if (!id) return;
      setNativeErrors((ids) => (ids.has(id) ? ids : new Set(ids).add(id)));
      if (round) return;
      round = true;
      queueMicrotask(() => (round = false));
      if (id === selectedRef.current) return;
      show(id);
      (event.target as HTMLElement).focus();
    };
    const onEdit = (event: Event) => {
      const id = panelOf(event.target);
      if (!id) return;
      const panel = el.querySelector(`[${PANEL}="${CSS.escape(id)}"]`);
      if (panel?.querySelector(":invalid")) return;
      setNativeErrors((ids) => {
        if (!ids.has(id)) return ids;
        const next = new Set(ids);
        next.delete(id);
        return next;
      });
    };
    const onReveal = (event: Event) => {
      const id = panelOf(event.target);
      if (id) show(id);
    };
    const updateMarked = () =>
      setMarkedErrors((ids) => {
        const next = invalidPanels(el);
        return same(ids, next) ? ids : next;
      });
    const marked = new MutationObserver(updateMarked);
    // The fields already marked when the form first renders.
    updateMarked();
    marked.observe(el, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["aria-invalid"],
    });
    el.addEventListener("invalid", onInvalid, true);
    el.addEventListener("input", onEdit);
    el.addEventListener("change", onEdit);
    el.addEventListener(REVEAL, onReveal);
    return () => {
      marked.disconnect();
      el.removeEventListener("invalid", onInvalid, true);
      el.removeEventListener("input", onEdit);
      el.removeEventListener("change", onEdit);
      el.removeEventListener(REVEAL, onReveal);
    };
  }, []);

  const select = (next: number) => {
    const tab = tabs[(next + tabs.length) % tabs.length];
    if (!tab) return;
    setSelectedId(tab.id);
    document.getElementById(tabId(tab.id))?.focus();
  };
  const onKeyDown = (event: KeyboardEvent) => {
    const move = { ArrowRight: index + 1, ArrowLeft: index - 1, Home: 0, End: tabs.length - 1 }[event.key];
    if (move === undefined) return;
    event.preventDefault();
    select(move);
  };

  return (
    <div ref={root} className={`flex flex-col gap-4 ${className}`}>
      <div ref={bar} role="tablist" aria-label={label} className={TAB_BAR}>
        {tabs.map((tab, i) => {
          const isCurrent = i === index;
          const error = !!tab.error || nativeErrors.has(tab.id) || markedErrors.has(tab.id);
          const parts = { ...tab, error };
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={tabId(tab.id)}
              aria-selected={isCurrent}
              aria-controls={panelId(tab.id)}
              tabIndex={isCurrent ? 0 : -1}
              aria-label={tabName(parts)}
              className={tabClass(isCurrent, accent)}
              onClick={() => setSelectedId(tab.id)}
              onKeyDown={onKeyDown}
            >
              <TabContent {...parts} accent={accent} />
            </button>
          );
        })}
      </div>
      {tabs.map((tab) => (
        <div
          key={tab.id}
          role="tabpanel"
          id={panelId(tab.id)}
          aria-labelledby={tabId(tab.id)}
          hidden={tab.id !== selected}
          data-form-tab-panel={tab.id}
        >
          {tab.panel}
        </div>
      ))}
    </div>
  );
}
