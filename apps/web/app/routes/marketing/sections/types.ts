import type { ScreenshotRef } from "../site/screenshots";
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

/**
 * The lockup home's hero leads with: the full logo (`FullLogo`, the name and
 * tagline from `BRAND`) as the `h1`, then one descriptor line.
 */
export type HeroLockup = { descriptor: string };

type HeroCopy = { eyebrow?: string; lead: string; primary: Cta; secondary?: Cta };

/** A hero leads with either home's lockup or the page's own `h1` heading. */
export type HeroContent = HeroCopy &
  ({ lockup: HeroLockup; heading?: never } | { lockup?: never; heading: string });

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

/** A page's opening: its only `h1` and a lead, with no calls to action. */
export type PageIntroContent = {
  eyebrow?: string;
  heading: string;
  lead: string;
};

/** One feature told at length: text beside an app screenshot. */
export type ShowcaseContent = {
  id: string;
  icon: MarketingIconName;
  heading: string;
  paragraphs: string[];
  /** Short points under the text. */
  points?: string[];
  image?: ScreenshotRef;
};

/** A row of app screenshots with a heading. */
export type GalleryContent = {
  id: string;
  heading: string;
  intro?: string;
  shots: ScreenshotRef[];
};

/** A heading and plain paragraphs (About). */
export type ProseContent = {
  id: string;
  heading: string;
  paragraphs: string[];
  /** Copy the team still has to write: shown with a "To be written" badge. */
  placeholder?: boolean;
  /** Smaller headed blocks (an `h3` each) after the paragraphs, such as bios. */
  subsections?: { heading: string; label?: string; paragraphs: string[] }[];
};

export type FaqItem = {
  question: string;
  /** One or more paragraphs. */
  answer: string[];
};

export type FaqGroup = {
  id: string;
  heading: string;
  items: FaqItem[];
};

/** A form field's copy: its label, and an optional hint under it. */
export type FieldCopy = { label: string; hint?: string };

/** What a public form says once it's sent (announced politely). */
export type FormThanksContent = { heading: string; body: string };

/** The waitlist form (home's waitlist band). */
export type WaitlistFormContent = {
  email: FieldCopy;
  firstName: FieldCopy;
  /** `none` is the empty first option. */
  caringFor: FieldCopy & { none: string };
  heardFrom: FieldCopy;
  submit: string;
  sending: string;
  thanks: FormThanksContent;
};

/** The waitlist band on home: a heading and body, the form, and other ways in. */
export type WaitlistBandContent = {
  id: string;
  heading: string;
  body: string;
  form: WaitlistFormContent;
  actions: Cta[];
};

/** The contact page: its only `h1`, a lead, the form, and other ways to reach the team. */
export type ContactPageContent = {
  meta: PageMeta;
  heading: string;
  lead: string;
  form: {
    name: FieldCopy;
    email: FieldCopy;
    topic: FieldCopy & { none: string };
    message: FieldCopy;
    submit: string;
    sending: string;
    thanks: FormThanksContent;
  };
  /** Short notes beside the form (privacy requests, response times). */
  notes: { heading: string; body: string }[];
};
