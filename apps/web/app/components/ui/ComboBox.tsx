import type { LucideIcon } from "lucide-react";
import type { FieldControl } from "./fieldIds";

import type { RefObject } from "react";

import { useContext, useEffect, useRef, useState } from "react";
import {
  ComboBox as AriaComboBox,
  ComboBoxStateContext,
  Header,
  Input,
  ListBox,
  ListBoxItem,
  ListBoxSection,
  Popover as AriaPopover,
} from "react-aria-components";
import { SURFACE } from "./styles";

/** One choice in a combo box: `description` is a second, dimmer line; `icon` says what it is (decorative). */
export type ComboBoxOption = { id: string; label: string; description?: string; icon?: LucideIcon };

/** A titled run of choices after the plain ones (ids unique across the whole list). */
export type ComboBoxSection = { id: string; heading: string; options: readonly ComboBoxOption[] };

/** Every choice is shown as given: the caller filters. */
const SHOW_ALL = () => true;

const CREATE = "\u0000create";
const ITEM =
  "rounded-field cursor-pointer px-3 py-2 outline-none data-[focused]:bg-base-200 data-[disabled]:opacity-50";
/** With an icon: the icon in a first column, beside the label and description. */
const ICON_ITEM = "grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3";

/**
 * A text field with a list of choices under it (React Aria: the list opens
 * on focus, arrow keys move, Enter or a tap picks, Escape closes the list and
 * then the field). The caller owns the text and filters `options` itself;
 * the combo box shows them as given. With `onCreate`, typed text that isn't
 * empty adds a last choice, `createLabel(text)`, that calls it. `sections`
 * come between the plain options and that last choice, each under its
 * heading (a named group); picking one of theirs calls `onSelect` too.
 *
 * `onClose` is called when the field loses focus or Escape is pressed with
 * the list closed, so a caller showing it in place of a button can go back.
 *
 * `opensOn="typing"` is for a free-text name with suggestions (a condition,
 * later an allergy or a medication): focus opens nothing, the first typed
 * character opens the list, and an empty field shows none (clearing it
 * closes the list); a pick closes it until the text changes again. The
 * default, `"focus"`, opens it on focus to browse; a pick closes it, and
 * it stays closed (even when the caller clears the text) until the field is
 * typed in, tapped, arrowed into or left.
 *
 * `reopenOn` is for a filter beside the field (the Link to box's type
 * chips): when it changes, the cursor goes back in the field and its list
 * opens again (when there's text to list for), showing what the filter left.
 *
 * `control` puts it inside a `Field`: the field's control props (its id,
 * `aria-invalid`, `aria-describedby` and classes) go on the text input, with
 * the input's own `name` (it then posts the text) and `maxLength`.
 */
export function ComboBox({
  label,
  placeholder,
  options,
  sections = [],
  inputValue,
  onInputChange,
  onSelect,
  createLabel,
  onCreate,
  emptyText = "No matches",
  onClose,
  focusOnMount,
  opensOn = "focus",
  reopenOn,
  control,
}: {
  /** The field's accessible name. */
  label: string;
  placeholder?: string;
  options: readonly ComboBoxOption[];
  /** Titled runs of choices after `options`. */
  sections?: readonly ComboBoxSection[];
  inputValue: string;
  onInputChange: (text: string) => void;
  onSelect: (id: string) => void;
  createLabel?: (text: string) => string;
  onCreate?: (text: string) => void;
  /** Shown in the list when nothing matches and there's nothing to create. */
  emptyText?: string;
  /** The field lost focus (`blur`, focus is elsewhere now) or Escape was pressed with the list closed (`escape`). */
  onClose?: (reason: "blur" | "escape") => void;
  /** Put the cursor in the field when it appears (it replaced the button that opened it). */
  focusOnMount?: boolean;
  /** When the list opens: on `focus` (browse every choice), or on `typing` (nothing for an empty field). */
  opensOn?: "focus" | "typing";
  /** A value that, when it changes, puts the cursor back in the field and opens its list (a filter beside it). */
  reopenOn?: unknown;
  /** From a `Field`'s render prop, plus the input's `name` and `maxLength`. */
  control?: FieldControl & { name?: string; maxLength?: number };
}) {
  const open = useRef(false);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (focusOnMount) input.current?.focus();
  }, [focusOnMount]);
  const typed = inputValue.trim();
  const create = onCreate && typed ? { id: CREATE, label: createLabel ? createLabel(typed) : typed } : null;
  // Typing mode: an empty field has no list, so React Aria closes it (and
  // won't open it) once the collection is empty and empty ones aren't allowed.
  // Nor does the text a pick just put in (React Aria would reopen on it).
  const [picked, setPicked] = useState<string | null>(null);
  // Focus mode: closed after a pick (React Aria would reopen it on the text
  // the caller then puts in) until the field is typed in, tapped, arrowed into or left.
  const [quiet, setQuiet] = useState(false);
  const pickedLabel = useRef<string | null>(null);
  const [woken, setWoken] = useState(0);
  const listed = opensOn === "focus" ? !quiet : typed !== "" && inputValue !== picked;
  const wake = () => {
    if (!quiet) return;
    setQuiet(false);
    setWoken((n) => n + 1);
  };

  return (
    <AriaComboBox
      aria-label={label}
      defaultFilter={SHOW_ALL}
      inputValue={inputValue}
      onInputChange={(text) => {
        if (text !== picked) setPicked(null);
        // Read from a ref: React Aria may put the picked label in before this render has it.
        if (text !== pickedLabel.current && text !== "") {
          pickedLabel.current = null;
          setQuiet(false);
        }
        onInputChange(text);
      }}
      selectedKey={null}
      onSelectionChange={(key) => {
        if (key === null) return;
        if (key === CREATE) onCreate?.(typed);
        else {
          const label =
            [...options, ...sections.flatMap((s) => s.options)].find((o) => o.id === key)?.label ?? null;
          if (opensOn === "typing") setPicked(label);
          else {
            pickedLabel.current = label;
            setQuiet(true);
          }
          onSelect(String(key));
        }
      }}
      onOpenChange={(isOpen) => {
        open.current = isOpen;
      }}
      menuTrigger={opensOn === "focus" ? "focus" : "input"}
      allowsCustomValue
      allowsEmptyCollection={listed}
      className="w-full"
    >
      <Input
        placeholder={placeholder}
        ref={input}
        autoComplete="off"
        onBlur={() => {
          setQuiet(false);
          onClose?.("blur");
        }}
        onPointerDown={wake}
        onKeyDown={(e) => {
          if (e.key === "Escape" && !open.current) onClose?.("escape");
          if (e.key === "ArrowDown" || e.key === "ArrowUp") wake();
        }}
        className="input input-sm w-full"
        {...control}
      />
      <Reopen on={reopenOn} input={input} listed={listed} />
      <Reopen on={woken} input={input} listed={listed} />
      <CloseWhen quiet={quiet} />
      <AriaPopover
        placement="bottom start"
        className={`${SURFACE} max-h-72 w-[var(--trigger-width)] min-w-56 overflow-y-auto p-1`}
      >
        <ListBox
          className="outline-none"
          renderEmptyState={() => <p className="text-muted px-3 py-2 text-sm">{emptyText}</p>}
        >
          {listed && options.map((item) => <Option key={item.id} item={item} />)}
          {listed &&
            sections.map((section) => (
              <ListBoxSection key={section.id} id={section.id} className="border-base-300 mt-1 border-t pt-1">
                <Header className="text-muted px-3 pt-1 pb-0.5 text-xs font-semibold">
                  {section.heading}
                </Header>
                {section.options.map((item) => (
                  <Option key={item.id} item={item} />
                ))}
              </ListBoxSection>
            ))}
          {create && <Option item={create} />}
        </ListBox>
      </AriaPopover>
    </AriaComboBox>
  );
}

/** Inside the combo box, so it can reach its state: focus the field and open the list when `on` changes. */
function Reopen({
  on,
  input,
  listed,
}: {
  on: unknown;
  input: RefObject<HTMLInputElement | null>;
  listed: boolean;
}) {
  const state = useContext(ComboBoxStateContext);
  const last = useRef(on);
  useEffect(() => {
    if (Object.is(last.current, on)) return;
    last.current = on;
    input.current?.focus();
    if (listed) state?.open(null, "manual");
  }, [on, input, listed, state]);
  return null;
}

/** Inside the combo box: close the list once `quiet` (after a focus-mode pick React Aria leaves it open). */
function CloseWhen({ quiet }: { quiet: boolean }) {
  const state = useContext(ComboBoxStateContext);
  useEffect(() => {
    if (quiet) state?.close();
  }, [quiet, state]);
  return null;
}

function Option({ item }: { item: ComboBoxOption }) {
  // The label stays the item's first child and the description its second,
  // with or without an icon (tests and helpers read the first child as the
  // label): the icon comes last in the markup and the grid puts it first.
  const Icon = item.icon;
  const text = Icon ? " col-start-2" : "";
  return (
    <ListBoxItem
      id={item.id}
      textValue={item.label}
      className={`${ITEM} ${Icon ? ICON_ITEM : "flex flex-col"} ${item.id === CREATE ? "text-primary font-medium" : ""}`}
    >
      <span className={`truncate${text}`}>{item.label}</span>
      {item.description && <span className={`text-muted truncate text-sm${text}`}>{item.description}</span>}
      {Icon && (
        <Icon
          aria-hidden="true"
          className={`text-muted col-start-1 row-start-1 size-4 shrink-0 ${item.description ? "row-span-2" : ""}`}
        />
      )}
    </ListBoxItem>
  );
}
