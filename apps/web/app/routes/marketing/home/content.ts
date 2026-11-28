import { BRAND } from "../../../components/brand/name";

import type {
  CtaBandContent,
  FeatureGridContent,
  GalleryContent,
  HeroContent,
  PageMeta,
  PromiseContent,
  StepsContent,
  WaitlistBandContent,
} from "../sections/types";
import { MARKETING_LINKS } from "../site/pages";
import { PRICE_HEADLINE, PRICE_PROMISE } from "../site/price";

/**
 * Home page copy (draft: the user edits it). Change the words here; the
 * layout is in the section components and `route.tsx`.
 */
export const homeContent = {
  meta: {
    title: `${BRAND.name}: ${BRAND.tagline}`,
    description:
      "The free care notebook for families: a shared place to keep track of a loved one's care, with daily notes, symptoms and vitals, medications and visits. On any phone, even offline.",
  } satisfies PageMeta,

  hero: {
    eyebrow: PRICE_HEADLINE,
    // The lockup: the full logo (name and tagline, from `BRAND`) is the h1 and
    // the descriptor sits under it. The share image (public/og-default.svg)
    // and its alt (site/meta.ts) say the same words.
    lockup: {
      descriptor: "A shared care journal, made by caregivers who've been there.",
    },
    lead: "Signal or not, caretakers can add today's notes, medications, visits and doctors' numbers, and it reaches everyone in the care group.",
    primary: { label: "Join the waitlist", href: MARKETING_LINKS.waitlist },
    secondary: { label: "Have an access code?", href: MARKETING_LINKS.join },
  } satisfies HeroContent,

  helps: {
    id: "what-it-helps-with",
    heading: "What Caretook helps with",
    intro: "The things families end up texting each other about, in one calm place.",
    items: [
      {
        icon: "timeline",
        title: "One shared timeline",
        body: "Log what happened today, a symptom, a reading or a visit in a few taps, or type it in one line. Everyone in the family sees the same timeline, in order.",
      },
      {
        icon: "notes",
        title: "Notes written together",
        body: "Take notes at a visit while your brother adds what he heard on the phone. You both see the note as it's written.",
      },
      {
        icon: "medications",
        title: "Medications and doses",
        body: "One list of what they take, a schedule for today, and one tap to log a dose as given, skipped or refused.",
      },
      {
        icon: "planner",
        title: "What's coming up",
        body: "Events and todos in one planner, with who's doing what. See them in your own calendar, with a reminder email if you want one.",
      },
    ],
  } satisfies FeatureGridContent,

  gallery: {
    id: "see-it",
    heading: "See it on a phone",
    shots: [
      {
        name: "timeline-rows",
        alt: "Grandma Pat's timeline: today's entries, with a note about lunch and blood pressure readings, and buttons to add a note, symptom, event or vitals.",
        caption: "The shared timeline",
      },
      {
        name: "live-note",
        alt: "A note titled Cardiology follow-up with notes from the visit and the next steps, and the initials of the other person writing it.",
        caption: "A note written together",
      },
      {
        name: "members",
        alt: "A care group's members: an owner, a caretaker and a viewer, each with their role.",
        caption: "Family, with the right access",
      },
    ],
  } satisfies GalleryContent,

  steps: {
    id: "how-it-works",
    heading: "How it works",
    items: [
      {
        title: "Start a care group",
        body: "One shared space for the person you care for.",
      },
      {
        title: "Invite family",
        body: "Add only the people your loved one agrees to share with, as caretakers or viewers.",
      },
      {
        title: "Log from any phone",
        body: "Add a note, a reading or a dose in seconds, even with no signal. It syncs when you're back online.",
      },
    ],
  } satisfies StepsContent,

  promise: {
    id: "privacy-promise",
    heading: "Our privacy promise",
    lead: "Your family's health information belongs to your family. The person being cared for comes first.",
    items: [
      { icon: "noAds", title: "No ads", body: "We never show ads, and never will." },
      { icon: "notSold", title: "Never sold", body: "We don't sell or rent your information to anyone." },
      {
        icon: "noTrackers",
        title: "No trackers",
        body: "No advertising or analytics tools can see your care data.",
      },
      {
        icon: "noAiTraining",
        title: "Not for AI training",
        body: "Caretook itself doesn't use AI on your information today. If you connect your own assistant (Claude or ChatGPT), what it reads goes to the AI vendor you chose. If we add AI features, their providers will not keep your data or train on it.",
      },
      {
        icon: "delete",
        title: "Yours to delete",
        body: "Write to us from the contact page and we'll delete your account and what's tied to it.",
      },
    ],
  } satisfies PromiseContent,

  // The price band: the same sentence as the FAQ's cost answer (site/price.ts).
  price: {
    id: "free-for-families",
    heading: PRICE_HEADLINE,
    body: PRICE_PROMISE,
    actions: [],
  } satisfies CtaBandContent,

  waitlist: {
    id: "waitlist",
    heading: "Join the waitlist",
    body: "We're letting families in a few at a time. Leave your email and we'll tell you when there's room for yours. We won't send you anything else.",
    form: {
      email: { label: "Email" },
      firstName: { label: "First name" },
      caringFor: { label: "Who do you care for?", none: "Choose one" },
      heardFrom: { label: "How did you hear about Caretook?" },
      submit: "Join the waitlist",
      sending: "Joining…",
      thanks: {
        heading: "Thanks, you're on the list.",
        body: "We'll email you when there's room for your family. If you signed up before, we've updated your details.",
      },
    },
    actions: [{ label: "Have an access code?", href: MARKETING_LINKS.join }],
  } satisfies WaitlistBandContent,
};

export type HomeContent = typeof homeContent;
