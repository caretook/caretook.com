# The UI kit (`apps/web/app/components/ui/`)

The `ui/` contracts; rules, tests: [components](components.md).

## What's in it

- **Primitives** import no feature folder; **only `ui/` imports React Aria** (lint).
- `ui/tooltip/`, `ui/date/` have own indexes. `DateTimeField`: hour arrows cross AM/PM; in `InlineCalendars` the calendar opens inline, one at once; `onCalendarPick` fires on a pick only.
- **`ui/plain`**, the light entry (no React Aria): light pages (sign-in, account, `/connect`, marketing) import it, never `ui`.
- **Append-only:** the `ui` and `ui/plain` indexes, `ui/styles.ts` and the gallery registry.
- **The gallery** `/dev/ui` (`routes/dev/ui/`, web only, 404 in production): each primitive in both themes, a `sections/` file each in `registry.ts`. A new primitive (**only for a repeated pattern**) adds one.

## Which to use

- **Every labelled form control is a `Field`** (`kind` owns the control's classes; only `ChoiceGroup` callers style one); checkboxes and switches are `CheckField` and `ToggleField`; a card a `Card`, a list box a `List` of `ListRow`s; every one-of-a-few choice a `ChoiceGroup` (native radios in a named `radiogroup`, a joined row, or `layout="grid"` two columns; `value` may be null); **every button a `Button`** (icon only: `icon` and a required `label`, name and tooltip; `IconButton`: ghost `sm`); a form's Cancel and submit a `FormFooter`; a back link a `BackLink`; two or three answers a `ChoiceDialog`; an expander a `Chevron` and `Collapse`. Not a `Button`: nav bars, inline links, site header/footer, expand toggles, `Menu` triggers, tabs, chips, row links, menu items, form controls, the date picker, avatars.
- **Messages:** an inline error or status line `Message`, a box `Notice`, a "No … yet." line `EmptyState`, a wait `Loading` (full page: `PageLoading`), a badge `Badge`.

## Contracts

- `Button`: `variant` `primary`, `secondary` (default), `ghost`, `danger`, `dangerQuiet`, `warning`; `size` `lg`/`md`/`sm`/`xs`; `shape` `rounded` (default), `pill`, `square`, `round`; `block`; `icon` (square unless shaped); `pressed` (toggle look), `expanded`, `controls`; `busy`+`busyLabel` (disabled, `aria-busy`); type `button` by default. With `to` a router link (`replace`, `state`, `prefetch`, `preventScrollReset`); `href` a plain `<a>`. `buttonClass` (pure) underlies `TOOL_CIRCLE`, the chips, the date field, `Menu`'s trigger. `OUTLINED`: filled on hover and press. `IconButton` `count`: corner badge.
- `Menu`'s trigger is a `buttonClass` look, `className` only outer classes; `Popover`'s takes a look or a bare string. Nav link: `navLinkClass`. Solid `danger` only in a confirm, a destructive-only form, or overdue Given all.
- `FormFooter` (forms only): Cancel (`{ label, to }` or `{ label, onCancel }`) then submit `Button` (`submitLabel`, `busy`, `busyLabel`, `submitDisabled`, `danger`, `size`); right-aligned or `align="start"`; `status` slot.
- `ConfirmDialog`/`useShowModal`: `confirmVariant` `danger` (default) or `primary`; waits for an open menu to close before `showModal()`.
- `ChoiceDialog` (`open`, `title`, `message`, up to three `choices` `{ id, label, tone, data-* }`, `cancelLabel`, `onChoose(id)`, `onClose`): `ConfirmDialog`'s rules; choices stacked, then Cancel.
- `PageHeader` `icon`, `accent`: a soft title chip. `add`: a `label` and `to`, `onPress` or `items` (`menuLabel`); a primary `sm` icon-only `+`, last, after `actions`.
- `Chevron` (`open`, `closed` `right`|`down`). `Collapse` (`open`, `id`, `axis` `block`|`inline`): closed is inert, hidden, mounted; the toggle keeps `aria-expanded`/`aria-controls`.
- `Sheet` is full screen below `sm`, a centred modal from it, above the tab bar; focus returns to its opener (from a `Menu` item: its button). Close, Escape, an outside tap play the exit (`useSheetExit`). The topmost sheet holds a path change for the exit (not a search or hash change, a submission or reduced motion); a save plays it on its caller's navigation. `guardChanges`: a changed form asks "Discard changes?" on those or Back, for the user's own edits only; a successful save skips it.
- **Accents** (`ui/accents.ts`): `ACCENTS`, `accentClass(accent | "neutral", "solid" | "soft" | "text")` over the `--color-hue-*` tokens; nothing else names one, none is a status colour. `IconChip` is hidden from assistive tech unless labelled.
- `UserAvatar` `look` (`color`, `icon`, `defaultColor`, `neutral`) beats `image`.
- `Field` gives its control `id`, `aria-invalid`, `aria-describedby`; a `warning` line (not invalid) if no error. `kind` (`input`, `select`, `textarea`): `<kind> w-full`, `<kind>-error` on error (`fieldControlClass`).
- **Required fields pass `required`** (`Field`, `ChoiceGroup`, `CheckField`, `DateTimeField`, `TimeSelect`): an `aria-hidden` `*` after the label (`text-error-ink`), `aria-required`, not native `required` (`CheckField` `nativeRequired`: consent boxes). No "(optional)" help;
- `CheckField`, `ToggleField` (input props, `label`, `help?`, `error?`): a native checkbox (toggle: `role="switch"`), label beside it, help and error describing it; `aria-label` replaces the label.
- `Card` (`{ id?, title?, headingId?, actions? }`): `base-100`; titled, a `section` named by its `h2` (`TITLE_SECTION`), `data-section`, `actions` by the title.
- `List` (`{ label? }`): one `ul` box with dividers. `ListRow` (`{ to?, trailing? }`, `data-*` on the `li`): with `to` one stretched link, `trailing` controls above it; for `href` or `state`, hand-write it.
- `DetailHeader`: `icon`, `tone` (`primary`, `neutral`, `muted`) or `media`; `title` the `h1` (`titleProps`; `min-w-0`, wraps beside the actions, which are Edit and a ⋯); `badges` (`STATUS_TONE`), `details` (`detailsProps`), `editors`, `actions`: each a `data-region`, empty: nothing.
- `ChipGroup`: link chips a `nav` (`aria-current="true"`), button chips a `ul` (`aria-pressed`).
- `ComboBox`: `options`, a controlled `inputValue`, `onSelect`, `onCreate?` (last), `sections`; the caller filters. `opensOn` `focus` (default; closed after a pick until typed, tapped, arrowed or left) or `typing` (none while empty); a new `reopenOn` reopens it. `control`: inside a `Field`.
- `TabNav` (look in `tabLook.tsx`, shared with `FormTabs`) (`{ label, tabs: [{ label, to, match?, current?, icon?, count?, replace? }] }`): a `nav` of links, not a tablist. A tab claims its path and below (`match` replaces that, `current` overrides both); the first claimant gets `aria-current="page"` from the pending navigation. `count` is a badge in the name. A segmented bar (no padding, gap or per-link rounding; the current fill reaches its edges, the focus ring inside); `accent` tints the current tab and counts (default primary). Equal tabs on phones, `sm:w-fit`.
- `FormTabs` (`{ label, tabs: [{ id, label, panel, hasContent?, error?, icon?, count? }], defaultTab? }`): a tablist whose panels switch in place and all stay mounted (hidden ones keep values and submit); Essentials first, Save outside it. A tab is marked filled in (`hasContent`) or errored (`error`, a native `invalid` field or any `aria-invalid` field on its panel); its name reads e.g. "Details, filled in, has an error". `revealField(form, field?)` switches to a field's tab and focuses it (no field: the first `aria-invalid`); from a `useEffect` wrap it in `requestAnimationFrame` (its `flushSync` is ignored there). Used by the provider and medication forms (B-694); short forms have none.
- `Message` (`{ tone, children }`): `error` `role="alert"`, others `role="status"`; empty, it stays mounted.
- `Notice` (`{ tone, icon?, action? }`): a soft alert with the tone's icon (or `icon`), role by tone (`role` overrides; `"none"` inside the caller's live region); `action`: `{ label, to }` link or `{ label, onAction }` button.
- `EmptyState`: a quiet line, optional action; `icon`, `accent` add a soft circle (main lists only).
- `toast({ message, action?, secondAction?, undo?, timeout? })` → id, `dismissToast(id)`: one at a time, newest first; an action runs once; 6 s (`null` stays).
- `Loading` (`{ label, lines? }`): a status named by `label`: spinner and label, or with `lines` a `Skeleton` (`aria-hidden` bars, `data-skeleton`).
- `PageLoading` (`{ message, back? }`): a full-page wait: `LoadingMark`, optional Go back, a slow prompt at 10 s.
- `Badge` (`{ tone, icon? }`): one size, soft (`badgeClass`); `neutral`, `primary`, `success`, `warning`, `danger`, `info`. **Status tones** (`STATUS_TONE`): current, now `primary`; past, stopped `neutral`; overdue `danger`; due soon `warning`; done `success`.
- `SearchFilterBar`: search (`?q=`, `lib/core/textFilter.ts`), `FilterMenu`, chips. `Highlight` (`MARK_CLASS`).

## Page, headings and tokens (`/app` only; marketing, print, `/admin` keep theirs)

- `Page` is a page's one `main` (`max-w-2xl`; `width="wide"` `max-w-4xl`), passes `data-*`, `id`, `className`. Every `/app` page but print sheets, the error screen, first sync.
- **Every section page starts with a `PageHeader`** (its `h1` and actions; `description`: one quiet line).
- **Heading scale** (`ui/styles.ts`): `TITLE_PAGE` `text-xl font-semibold`, `TITLE_SECTION` `text-base font-semibold` (sections and cards), `TITLE_SUB` `text-sm font-semibold`.
- **Tokens:** `text-muted` (70%), `text-faint` (62%, 4.5:1 on light) in `app.css`. `LINK` (`link text-primary-ink`); `text-<tone>-ink` lifts a tone's text to 4.5:1. `ui/styles.ts`: `ICON_SM`/`ICON`/`ICON_LG` (`size-3.5`, `4`, `5`), `COUNT_BADGE`, `CHOICE_BUTTON`, `CHOICE_TILE`.

## Bands

- `Page bands` is a `main[data-bands]` with no column; every child is a `Section`: a full-width band, alternating `base-200`/`base-100` (CSS), a `base-300` rule above all but the first, `py-6`, an inner `max-w-2xl px-4` column. A `Section` takes `title` (an `h2`: a named `section`), `id` (`data-section`), `actions`, `description`, `aria-label`.
- **Banded pages:** medication, provider, care period, to-do, profile. The first band holds the `BackLink` and the `DetailHeader`; **each part component is the `Section` itself**, never wrapped, with its role checks and hooks. No cards in a band. Parts shared with unbanded pages take `band` (`LinkedTodos`, `AllergiesRegion`). Tests read bands with `test/bands.ts`.
