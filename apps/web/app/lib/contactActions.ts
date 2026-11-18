import type { ProviderPhone } from "@caretook/data/schema";

// One-tap ways to reach a provider: the `href`s for calling, emailing, mapping
// their address and opening their website, with the accessible names the
// buttons carry ("Call Dr. Alvarez, office"). Pure: no React here, so the
// list, the provider page and later screens share it, and web:unit tests it.

export type ContactAction = {
  kind: "call" | "email" | "map" | "website";
  href: string;
  /** The control's accessible name. */
  label: string;
  /** What the action reaches (the number, address…), for a tooltip or visible text. */
  value: string;
};

// "x214", "ext. 214", "extension 214" at the end of a number.
const EXTENSION = /\s*(?:x|ext\.?|extension)\s*(\d+)\s*$/i;

/**
 * A `tel:` link for a number as people type it: digits and a leading `+`
 * are kept. An extension ("x214", "ext. 214") is dialled after a pause
 * (`,`), which phone dialers follow. Null when there are no digits.
 */
export const telHref = (number: string): string | null => {
  const ext = EXTENSION.exec(number);
  const main = ext ? number.slice(0, ext.index) : number;
  const digits = main.replace(/\D/g, "");
  if (!digits) return null;
  const plus = main.trim().startsWith("+") ? "+" : "";
  return `tel:${plus}${digits}${ext ? `,${ext[1]}` : ""}`;
};

/** A `mailto:` link, or null for an empty address. */
export const mailtoHref = (email: string): string | null => {
  const address = email.trim();
  return address ? `mailto:${encodeURI(address)}` : null;
};

/**
 * A maps search for an address (lines joined with commas). Google Maps'
 * search URL opens the maps app on phones and the site elsewhere.
 */
export const mapsHref = (address: string): string | null => {
  const query = address
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .join(", ");
  return query ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}` : null;
};

/**
 * A website as a link: `https://` added when no scheme is given. Only http
 * and https links are made (never `javascript:` or the like).
 */
export const websiteHref = (website: string): string | null => {
  const text = website.trim();
  if (!text) return null;
  const withScheme = /^[a-z][a-z\d+.-]*:/i.test(text) ? text : `https://${text}`;
  try {
    const url = new URL(withScheme);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch {
    return null;
  }
};

/** "Call Dr. Alvarez, office", or "Call Dr. Alvarez" for an unlabelled number. */
export const callLabel = (name: string, phone: ProviderPhone) => {
  const label = phone.label.trim().toLowerCase();
  return label ? `Call ${name}, ${label}` : `Call ${name}`;
};

/** The action for one of a provider's numbers, or null when it can't be dialled. */
export const callAction = (name: string, phone: ProviderPhone): ContactAction | null => {
  const href = telHref(phone.number);
  return href ? { kind: "call", href, label: callLabel(name, phone), value: phone.number } : null;
};

export type Contactable = {
  name: string;
  phones: ProviderPhone[];
  email: string | null;
  address: string | null;
  website?: string | null;
};

const emailAction = (name: string, email: string | null): ContactAction | null => {
  const href = email ? mailtoHref(email) : null;
  return href && email ? { kind: "email", href, label: `Email ${name}`, value: email } : null;
};

const mapAction = (name: string, address: string | null): ContactAction | null => {
  const href = address ? mapsHref(address) : null;
  return href && address
    ? { kind: "map", href, label: `Open ${name}'s address in maps`, value: address }
    : null;
};

const websiteAction = (name: string, website: string | null | undefined): ContactAction | null => {
  const href = website ? websiteHref(website) : null;
  return href && website ? { kind: "website", href, label: `Open ${name}'s website`, value: website } : null;
};

const present = (actions: (ContactAction | null)[]) => actions.filter((a): a is ContactAction => a !== null);

/**
 * A list row's quick actions: call the first number, email, and map the
 * address, each only when there's something to reach. (Websites and the
 * other numbers are on the provider's page.)
 */
export const quickActions = ({ name, phones, email, address }: Contactable): ContactAction[] =>
  present([
    phones[0] ? callAction(name, phones[0]) : null,
    emailAction(name, email),
    mapAction(name, address),
  ]);

/** Every way to reach a provider: each number, then email, address and website. */
export const allActions = ({ name, phones, email, address, website }: Contactable): ContactAction[] =>
  present([
    ...phones.map((phone) => callAction(name, phone)),
    emailAction(name, email),
    mapAction(name, address),
    websiteAction(name, website),
  ]);
