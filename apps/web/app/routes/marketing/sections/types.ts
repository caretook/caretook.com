import type { MarketingIconName } from "./icons";

/**
 * The shapes content modules fill and section components render. Copy lives
 * in each page's `content.ts`; layout lives in the section components.
 */
export type PageMeta = {
  /** The page's own title; `marketingMeta` adds " · Caretook". */
  title: string;
  /** About 70–160 characters: what search results and link previews show. */
  description: string;
};

export type Cta = { label: string; href: string };

export type HeroContent = {
  eyebrow?: string;
  /** The page's only `h1`. */
  heading: string;
  lead: string;
  primary: Cta;
  secondary?: Cta;
};

export type FeatureItem = { icon: MarketingIconName; title: string; body: string };

export type FeatureGridContent = {
  id: string;
  heading: string;
  intro?: string;
  items: FeatureItem[];
};

export type StepsContent = {
  id: string;
  heading: string;
  intro?: string;
  items: { title: string; body: string }[];
};

export type PromiseContent = {
  id: string;
  heading: string;
  lead: string;
  items: FeatureItem[];
};

export type CtaBandContent = {
  id: string;
  heading: string;
  body: string;
  /** A short status line, such as "Coming soon". */
  note?: string;
  actions: Cta[];
};

/** A page that isn't written yet (filled by a later slice). */
export type ComingSoonContent = {
  meta: PageMeta;
  heading: string;
  lead: string;
};
