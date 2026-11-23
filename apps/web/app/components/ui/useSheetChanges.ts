import type { RefObject } from "react";

import { useCallback, useEffect, useRef } from "react";

// Whether a person changed a sheet's form. Fields are read from the DOM, so
// every kit control counts, the hidden input behind a `TimeSelect` included.
// A new value is the person's if it lands during or just after their press,
// key or edit (anywhere: a picker's own sheet is outside this panel). Any other
// new value came from a re-render or a sync: it moves the start instead.

/** How long after a press, key or edit a new value still counts as that person's. */
export const OWN_CHANGE_MS = 300;

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

/** A form's starting values, the values last read, and the fields the person changed. */
type Tracked = { root: Element; start: Map<string, string>; seen: Map<string, string>; own: Set<string> };

const track = (root: Element): Tracked => {
  const fields = readFields(root);
  return { root, start: fields, seen: new Map(fields), own: new Set() };
};

/** Takes in what changed since the last read, as the person's or as arriving from elsewhere. */
function reconcile(tracked: Tracked, mine: boolean) {
  const now = readFields(tracked.root);
  for (const key of new Set([...tracked.seen.keys(), ...now.keys()])) {
    if ((tracked.seen.get(key) ?? "") === (now.get(key) ?? "")) continue;
    if (mine) {
      tracked.own.add(key);
    } else {
      tracked.start.set(key, now.get(key) ?? "");
      tracked.own.delete(key);
    }
  }
  tracked.seen = now;
}

const ownFields = (fields: Map<string, string>, own: Set<string>) =>
  new Map([...fields].filter(([key]) => own.has(key)));

export function useSheetChanges(
  panelRef: RefObject<HTMLElement | null>,
  guard: boolean | string,
  isOpen: boolean,
) {
  const tracked = useRef<Tracked | null>(null);
  // Set from a press, key or edit until `OWN_CHANGE_MS` after the last one.
  const acting = useRef<ReturnType<typeof setTimeout> | null>(null);
  // A submit or the form's own Cancel: the sheet may close without asking,
  // until the person does something else or the save is refused.
  const leaving = useRef(false);
  const submitted = useRef<Submitted | null>(null);

  const watched = useCallback(() => {
    const panel = panelRef.current;
    return typeof guard === "string" ? (panel?.querySelector(guard) ?? null) : panel;
  }, [panelRef, guard]);

  /** The form as it stands, with everything since the last read taken in. */
  const current = useCallback(
    (mine: boolean) => {
      const root = watched();
      if (!root) return null;
      // A new form (the next add, or another row to edit) starts over.
      if (tracked.current?.root !== root) tracked.current = track(root);
      else reconcile(tracked.current, mine);
      return tracked.current;
    },
    [watched],
  );

  useEffect(() => {
    tracked.current = null;
    leaving.current = false;
    submitted.current = null;
    if (guard === false || !isOpen) return;
    const first = watched();
    if (first) tracked.current = track(first);
    const inPanel = (e: Event) => e.target instanceof Node && panelRef.current?.contains(e.target) === true;
    const act = (e: Event) => {
      // An `input` or `change` has already changed the value: it's the person's.
      current(acting.current !== null || e.type === "input" || e.type === "change");
      if (acting.current !== null) clearTimeout(acting.current);
      acting.current = setTimeout(() => {
        acting.current = null;
        current(true);
      }, OWN_CHANGE_MS);
    };
    const touch = (e: Event) => {
      act(e);
      if (inPanel(e) && !onSubmitButton(e.target)) leaving.current = false;
    };
    const leave = (e: Event) => {
      if (!(e.target instanceof Element) || !watched()?.contains(e.target)) return;
      if (e.type !== "submit" && !e.target.closest("[data-form-cancel]")) return;
      leaving.current = true;
      submitted.current = e.type === "submit" ? { form: e.target, alerts: alertsIn(e.target) } : null;
    };
    const listeners: [string, (e: Event) => void][] = [
      ["beforeinput", act],
      ["pointerup", act],
      ["keyup", act],
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
      if (acting.current !== null) clearTimeout(acting.current);
      acting.current = null;
    };
  }, [panelRef, guard, isOpen, watched, current]);

  return useCallback(() => {
    if (leaving.current && submitted.current && wasRefused(submitted.current)) leaving.current = false;
    if (guard === false || leaving.current) return false;
    const form = current(acting.current !== null);
    if (!form || form.own.size === 0) return false;
    return fieldsDiffer(ownFields(form.start, form.own), ownFields(form.seen, form.own));
  }, [guard, current]);
}
