import type { RefObject } from "react";

import { useCallback, useEffect, useRef } from "react";

// Whether a person changed a sheet's form. The starting values are read just
// before their first touch, so what a re-render or a sync put there earlier
// never counts. Fields are read from the DOM, so every kit control counts,
// the hidden input behind a `TimeSelect` included.

const FIELDS = "input, select, textarea, [contenteditable='true']";

/** Each field's value by a stable key; a checkbox or radio is keyed by its value too. */
export function readFields(root: ParentNode): Map<string, string> {
  const fields = new Map<string, string>();
  const seen = new Map<string, number>();
  for (const el of root.querySelectorAll<HTMLElement>(FIELDS)) {
    const input = el instanceof HTMLInputElement ? el : null;
    const checkable = input?.type === "checkbox" || input?.type === "radio";
    const base = `${el.getAttribute("name") || el.id || "field"}${checkable ? `:${input.value}` : ""}`;
    const nth = seen.get(base) ?? 0;
    seen.set(base, nth + 1);
    const value = checkable
      ? input.checked
        ? "1"
        : ""
      : el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement
        ? el.value
        : (el.textContent ?? "");
    fields.set(`${base}#${nth}`, value);
  }
  return fields;
}

/** A field that appeared or left empty (a section opening) is no change. */
export function fieldsDiffer(start: Map<string, string>, now: Map<string, string>) {
  for (const key of new Set([...start.keys(), ...now.keys()])) {
    if ((start.get(key) ?? "") !== (now.get(key) ?? "")) return true;
  }
  return false;
}

const onSubmitButton = (target: EventTarget | null) =>
  target instanceof Element && target.closest('button[type="submit"]') !== null;

/** A submitted form and the alerts it already showed (a warning being answered, a past refusal). */
type Submitted = { form: Element; alerts: ReadonlySet<Element> };

const alertsIn = (form: Element) => new Set(form.querySelectorAll('[role="alert"]'));

/** The save didn't go through: a field is marked, or a new alert has something to say. */
const wasRefused = ({ form, alerts }: Submitted) =>
  form.querySelector('[aria-invalid="true"]') !== null ||
  [...alertsIn(form)].some((alert) => !alerts.has(alert) && alert.textContent?.trim());

export function useSheetChanges(
  panelRef: RefObject<HTMLElement | null>,
  guard: boolean | string,
  isOpen: boolean,
) {
  const start = useRef<{ root: Element; fields: Map<string, string> } | null>(null);
  const touched = useRef(false);
  // A submit or the form's own Cancel: the sheet may close without asking,
  // until the person does something else or the save is refused.
  const leaving = useRef(false);
  const submitted = useRef<Submitted | null>(null);

  const watched = useCallback(() => {
    const panel = panelRef.current;
    return typeof guard === "string" ? (panel?.querySelector(guard) ?? null) : panel;
  }, [panelRef, guard]);

  useEffect(() => {
    start.current = null;
    touched.current = false;
    leaving.current = false;
    submitted.current = null;
    if (guard === false || !isOpen) return;
    // Where the form starts; a first touch reads it again, past any re-render.
    const first = watched();
    if (first) start.current = { root: first, fields: readFields(first) };
    const inPanel = (e: Event) => e.target instanceof Node && panelRef.current?.contains(e.target) === true;
    const before = (e: Event) => {
      if (!inPanel(e)) return;
      const root = watched();
      if (!root) return;
      // A new form (the next add, or another row to edit) starts over.
      if (start.current?.root !== root) touched.current = false;
      if (!touched.current) start.current = { root, fields: readFields(root) };
    };
    const touch = (e: Event) => {
      if (!inPanel(e)) return;
      // An `input` or `change` has already changed the value: too late to read the start.
      if (e.type !== "input" && e.type !== "change") before(e);
      touched.current = true;
      if (!onSubmitButton(e.target)) leaving.current = false;
    };
    const leave = (e: Event) => {
      if (!(e.target instanceof Element) || !watched()?.contains(e.target)) return;
      if (e.type !== "submit" && !e.target.closest("[data-form-cancel]")) return;
      leaving.current = true;
      submitted.current = e.type === "submit" ? { form: e.target, alerts: alertsIn(e.target) } : null;
    };
    const listeners: [string, (e: Event) => void][] = [
      ["focusin", before],
      ["beforeinput", before],
      ["pointerdown", touch],
      ["keydown", touch],
      ["input", touch],
      ["change", touch],
      ["click", leave],
      ["submit", leave],
    ];
    for (const [type, listener] of listeners) document.addEventListener(type, listener, true);
    return () => {
      for (const [type, listener] of listeners) document.removeEventListener(type, listener, true);
    };
  }, [panelRef, guard, isOpen, watched]);

  return useCallback(() => {
    const root = watched();
    if (leaving.current && submitted.current && wasRefused(submitted.current)) leaving.current = false;
    if (guard === false || !root || !touched.current || leaving.current) return false;
    if (start.current?.root !== root) return false;
    return fieldsDiffer(start.current.fields, readFields(root));
  }, [guard, watched]);
}
