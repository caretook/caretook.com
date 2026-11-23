import type { DeviceRoute } from "../../../../../test/device";

import { page, userEvent } from "vitest/browser";
import { fx, hoursAgo, TEST_GROUP, TEST_USER } from "../../../../../test/fixtures";
import { found, waitUntil } from "../../../../../test/found";
import { getByCss } from "../../../../../test/locators";
import * as entryRoute from "../entry/route";
import * as providerRoute from "../provider/route";
import * as editSheet from "./edit/route";
import * as importSheet from "./import/route";
import * as newSheet from "./new/route";
import * as providers from "./route";

// The providers' component tests share one fictional directory, shaped like
// the seeds' (providers.mjs used them): a primary practice and its clinician
// (an office number with an extension), a cardiologist, a pharmacy, a home
// health aide, a hospital and a past orthopedist, a few shared notes, and
// two "Pharmacy pickup" events linked to the pharmacy and the cardiologist.
// A second group the user is also in has one provider of its own. Only
// `*.browser.test.tsx` files import it.

export const GROUP = TEST_GROUP.id;

export const WESTSIDE = fx.provider({
  type: "practice",
  name: "Westside Family Medicine",
  specialty: "Primary care",
  phones: [
    { label: "Front desk", number: "(555) 010-2200" },
    { label: "Fax", number: "(555) 010-2201" },
    { label: "Nurse line", number: "(555) 010-2210" },
  ],
  address: "1200 Westside Ave, Suite 300\nSpringfield, CA 90000",
  website: "westsidefamily.example",
  isPrimary: 1,
});
export const ALVAREZ = fx.provider({
  name: "Dr. Elena Alvarez",
  specialty: "Internal medicine",
  practiceId: WESTSIDE.id,
  phones: [
    { label: "Office", number: "(555) 010-2200 x214" },
    { label: "After hours", number: "(555) 010-2299" },
  ],
  email: "e.alvarez@westsidefamily.example",
  isPrimary: 1,
});
export const PATEL = fx.provider({
  name: "Dr. Samuel Patel",
  specialty: "Cardiology",
  phones: [{ label: "Office", number: "(555) 010-3300" }],
  address: "48 Harbor Heart Center\nSpringfield, CA 90000",
  website: "https://harborheart.example/patel",
});
export const CORNERSTONE = fx.provider({
  type: "pharmacy",
  name: "Cornerstone Pharmacy",
  specialty: null,
  phones: [
    { label: "Pharmacy", number: "(555) 010-4400" },
    { label: "Refills", number: "(555) 010-4401" },
  ],
  address: "310 Main St\nSpringfield, CA 90000",
  website: "cornerstonepharmacy.example",
  isPrimary: 1,
});
export const MARIA = fx.provider({
  type: "other",
  name: "Maria Reyes",
  specialty: "Home health aide",
  phones: [{ label: "Mobile", number: "+1 555 010 5500" }],
  email: "maria.reyes@example.com",
});
export const WHITFORD = fx.provider({
  name: "Dr. Alan Whitford",
  specialty: "Orthopedics",
  phones: [{ label: "Office", number: "(555) 010-6600" }],
  status: "past",
});
export const MERCY = fx.provider({
  type: "practice",
  name: "Mercy General Hospital",
  specialty: "Hospital",
  phones: [{ label: "Main", number: "(555) 010-8800" }],
  address: "2500 Mercy Way\nSpringfield, CA 90000",
  website: "mercygeneral.example",
});

/** The directory as it lists: primary first, then current by name. */
export const CURRENT_NAMES = [
  "Cornerstone Pharmacy",
  "Dr. Elena Alvarez",
  "Westside Family Medicine",
  "Dr. Samuel Patel",
  "Maria Reyes",
  "Mercy General Hospital",
];

/** Shared notes, as provider documents. */
export const WESTSIDE_NOTES = fx.document({
  ownerId: WESTSIDE.id,
  subject: "provider",
  text: "Park on level 2 of the garage; ask for Rosa at the front desk.",
});
export const ALVAREZ_NOTES = fx.document({
  ownerId: ALVAREZ.id,
  subject: "provider",
  text: "Prefers questions sent through the portal two days before a visit.",
});

/** Two earlier pickups linked to the pharmacy and the cardiologist (what a title used before suggests). */
export const PICKUP = fx.event({ title: "Pharmacy pickup", occurredAt: hoursAgo(24 * 20) });
export const PICKUP_2 = fx.event({ title: "Pharmacy pickup", occurredAt: hoursAgo(24 * 50) });
export const PICKUP_LINKS = [
  fx.link(PICKUP.id, CORNERSTONE.id, { createdAt: hoursAgo(24 * 20) }),
  fx.link(PICKUP.id, PATEL.id, { createdAt: hoursAgo(24 * 20) }),
  fx.link(PICKUP_2.id, CORNERSTONE.id, { createdAt: hoursAgo(24 * 50) }),
];

/** A second group the user also belongs to, with one provider. */
export const SECOND_GROUP = { id: "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2f1b02", name: "Lindqvist Family" };
export const LINDQVIST = fx.provider({
  groupId: SECOND_GROUP.id,
  name: "Dr. Grace Lindqvist",
  specialty: "Audiology",
  phones: [{ label: "Office", number: "(555) 010-7700" }],
  isPrimary: 1,
});
export const secondGroup = (role: "caretaker" | "viewer" = "caretaker") => [
  fx.group({ id: SECOND_GROUP.id, name: SECOND_GROUP.name }),
  fx.recipient({
    id: "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2f1c02",
    groupId: SECOND_GROUP.id,
    name: "Lou Lindqvist",
    // So the group shows as "Lou Lindqvist", not the default recipient's preferred name.
    preferredName: null,
  }),
  fx.member({ userId: TEST_USER.id, groupId: SECOND_GROUP.id, role }),
  LINDQVIST,
];

/** The whole directory: providers, notes, the pickups and their links. */
export const directory = () => [
  WESTSIDE,
  ALVAREZ,
  PATEL,
  CORNERSTONE,
  MARIA,
  WHITFORD,
  MERCY,
  WESTSIDE_NOTES,
  ALVAREZ_NOTES,
  PICKUP,
  PICKUP_2,
  PICKUP_LINKS,
];

export const PROVIDERS_URL = `/app/groups/${GROUP}/providers`;
export const providerUrl = (id: string, group: string = GROUP) => `/app/groups/${group}/providers/${id}`;
export const entryUrl = (id: string) => `/app/groups/${GROUP}/entries/${id}`;

/** The directory with its sheets, a provider's page and the entry page, as routes.ts nests them. */
export const PROVIDER_ROUTES: DeviceRoute[] = [
  {
    path: "/app/groups/:groupId/providers",
    module: providers,
    children: [
      { path: "/app/groups/:groupId/providers/new", module: newSheet },
      { path: "/app/groups/:groupId/providers/import", module: importSheet },
      { path: "/app/groups/:groupId/providers/:providerId/edit", module: editSheet },
    ],
  },
  { path: "/app/groups/:groupId/providers/:providerId", module: providerRoute },
  { path: "/app/groups/:groupId/entries/:entryId", module: entryRoute },
];

// --- DOM helpers (providers.mjs's selectors) ---------------------------------

/** The names in one of the directory's lists. */
export const listNames = (label: "Current providers" | "Past providers") =>
  [...document.querySelectorAll<HTMLElement>(`main ul[aria-label="${label}"] [data-provider-name]`)].map(
    (n) => n.textContent.trim(),
  );
export const SEARCH = () => document.querySelector<HTMLInputElement>('main input[type="search"]');
/** The "Filters on" chips' labels (without their ✕). */
export const filterChips = () =>
  [...document.querySelectorAll<HTMLElement>('main nav[aria-label="Filters on"] a')].map((a) =>
    a.textContent.trim(),
  );
/** The Filter button, by its exact name: the menu ("Filter providers") and the chips ("Filters on") are named alike. */
export const filterButton = () => page.getByRole("button", { name: /^Filter(, \d+ on)?$/ });
/** Opens the Filter menu and chooses an option (the menu closes). */
export const chooseFilter = async (option: string) => {
  await userEvent.click(filterButton());
  await userEvent.click(page.getByRole("menuitemradio", { name: option, exact: true }));
};
export const ADD_PROVIDER = () => document.querySelector<HTMLAnchorElement>("main [data-add-provider]");

export const SHEET = () => document.querySelector<HTMLElement>("[role=dialog]");
export const FORM = () => document.querySelector<HTMLFormElement>("[role=dialog] [data-provider-form]");
export const field = <T extends HTMLElement = HTMLInputElement>(name: string, n = 0) =>
  FORM()?.querySelectorAll<T>(`[name="${name}"]`)[n] ?? null;
export const formButton = (text: string) =>
  [...(FORM()?.querySelectorAll<HTMLButtonElement>("button") ?? [])].find((b) =>
    b.textContent?.includes(text),
  );
/** The sheet's Save, as a locator. */
export const submit = () => getByCss('[role=dialog] [data-provider-form] button[type="submit"]');
/** Each invalid field's name (phones by position) and its message, plus the phones message. */
export const fieldErrors = () => {
  const form = FORM();
  const out: Record<string, string> = {};
  if (!form) return out;
  for (const el of form.querySelectorAll<HTMLInputElement>('[aria-invalid="true"]')) {
    const same = [...form.querySelectorAll(`[name="${el.name}"]`)];
    const key = el.name + (el.name.startsWith("phone") ? same.indexOf(el) : "");
    out[key] =
      document.getElementById(el.getAttribute("aria-describedby")!.split(" ").at(-1)!)?.textContent ?? "";
  }
  const set = form.querySelector("fieldset[aria-describedby]");
  if (set) out.phones = document.getElementById(set.getAttribute("aria-describedby")!)?.textContent ?? "";
  return out;
};
/** Replace a field's text, as typing it would. */
export const fill = async (name: string, value: string, n = 0) => {
  const el = await found(() => field<HTMLInputElement | HTMLTextAreaElement>(name, n));
  await userEvent.clear(el);
  if (value) await userEvent.type(el, value);
};
export const CONFIRM = () => document.querySelector<HTMLDialogElement>("dialog.modal");
export const confirmButton = (text: string) =>
  [...(CONFIRM()?.querySelectorAll<HTMLButtonElement>("button") ?? [])].find(
    (b) => b.textContent?.trim() === text,
  );

/** The provider page's editor (its live notes). */
export const NOTES = () => document.querySelector<HTMLElement>(".ProseMirror");
export const pageHeader = () => ({
  h1: document.querySelector<HTMLElement>("main h1")?.textContent?.trim() ?? null,
  badges: [...document.querySelectorAll<HTMLElement>('main header [data-region="title"] .badge')].map((b) =>
    b.textContent.trim(),
  ),
  details:
    document.querySelector<HTMLElement>('main header [data-region="details"]')?.textContent?.trim() ?? null,
  practice: document.querySelector<HTMLElement>("main header [data-practice]")?.getAttribute("href") ?? null,
});
export const contactLinks = () =>
  [...document.querySelectorAll<HTMLAnchorElement>("main [data-contact-list] a")].map((a) => [
    a.dataset.action,
    a.getAttribute("href"),
  ]);

/** The entry header's With row. */
export const WITH = () => document.querySelector<HTMLElement>('main header [data-region="with"]');
export const ADD_LINK = () => WITH()?.querySelector<HTMLButtonElement>("[data-add-provider-link]") ?? null;
export const PICKER = () => WITH()?.querySelector<HTMLInputElement>("input") ?? null;
export const option = (text: string) =>
  [...document.querySelectorAll<HTMLElement>('[role="option"]')].find(
    (o) => o.firstElementChild?.textContent === text,
  );
export const chips = () =>
  [...(WITH()?.querySelectorAll<HTMLLIElement>("li[data-chip]") ?? [])].map((li) => ({
    id: li.dataset.chip!,
    text: li.textContent.trim(),
    href: li.querySelector("a")?.getAttribute("href") ?? null,
    muted: li.className.includes("text-base-content/50"),
    remove: !!li.querySelector("button"),
  }));
export const SUGGESTIONS = () => WITH()?.querySelector<HTMLElement>("[data-provider-suggestions]") ?? null;
export const suggested = () =>
  [...(SUGGESTIONS()?.querySelectorAll("ul button") ?? [])].map((b) => b.textContent.trim());
export const suggestion = (name: string) =>
  [...(SUGGESTIONS()?.querySelectorAll<HTMLButtonElement>("button") ?? [])].find(
    (b) => b.textContent?.trim() === name,
  );
export const ENTRY_TITLE = () => document.querySelector<HTMLInputElement>("main header input");

/** Open the With row's picker, type `text`, and take the option `optionText`. */
export const pick = async (text: string, optionText: string) => {
  await userEvent.click(await found(ADD_LINK, { message: "the With row's Add" }));
  await waitUntil(() => !!PICKER() && document.activeElement === PICKER(), "the picker");
  await userEvent.keyboard(text);
  await userEvent.click(await found(() => option(optionText), { message: `the option ${optionText}` }));
};
