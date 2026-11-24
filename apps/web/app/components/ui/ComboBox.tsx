import { useEffect, useRef } from "react";
import {
  ComboBox as AriaComboBox,
  Header,
  Input,
  ListBox,
  ListBoxItem,
  ListBoxSection,
  Popover as AriaPopover,
} from "react-aria-components";
import { SURFACE } from "./styles";

/** One choice in a combo box: `description` is a second, dimmer line. */
export type ComboBoxOption = { id: string; label: string; description?: string };

/** A titled run of choices after the plain ones (ids unique across the whole list). */
export type ComboBoxSection = { id: string; heading: string; options: readonly ComboBoxOption[] };

/** Every choice is shown as given: the caller filters. */
const SHOW_ALL = () => true;

const CREATE = "\u0000create";
const ITEM =
  "rounded-field flex cursor-pointer flex-col px-3 py-2 outline-none data-[focused]:bg-base-200 data-[disabled]:opacity-50";

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
 * closes the list). The default, `"focus"`, opens it on focus to browse.
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
  const listed = opensOn === "focus" || typed !== "";

  return (
    <AriaComboBox
      aria-label={label}
      defaultFilter={SHOW_ALL}
      inputValue={inputValue}
      onInputChange={onInputChange}
      selectedKey={null}
      onSelectionChange={(key) => {
        if (key === null) return;
        if (key === CREATE) onCreate?.(typed);
        else onSelect(String(key));
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
        onBlur={() => onClose?.("blur")}
        onKeyDown={(e) => {
          if (e.key === "Escape" && !open.current) onClose?.("escape");
        }}
        className="input input-sm w-full"
      />
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

function Option({ item }: { item: ComboBoxOption }) {
  return (
    <ListBoxItem
      id={item.id}
      textValue={item.label}
      className={`${ITEM} ${item.id === CREATE ? "text-primary font-medium" : ""}`}
    >
      <span className="truncate">{item.label}</span>
      {item.description && <span className="text-muted truncate text-sm">{item.description}</span>}
    </ListBoxItem>
  );
}
