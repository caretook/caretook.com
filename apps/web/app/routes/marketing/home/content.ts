import type {
  CtaBandContent,
  FeatureGridContent,
  GalleryContent,
  HeroContent,
  PageMeta,
  PromiseContent,
  StepsContent,
} from "../sections/types";
import { MARKETING_LINKS } from "../site/pages";

/**
 * Home page copy (draft: the user edits it). Change the words here; the
 * layout is in the section components and `route.tsx`.
 */
export const homeContent = {
  meta: {
    title: "Caretook: keep track of someone's care, together",
    description:
      "A shared place for a family to keep track of a loved one's care: daily notes, symptoms and vitals, and visits. On any phone, even offline. Free while in early access.",
  } satisfies PageMeta,

  hero: {
    eyebrow: "Free while in early access",
    heading: "Keep track of someone's care, together.",
    lead: "Caretook is a shared place for a family to keep track of a loved one's care: what happened today, symptoms and vitals, notes from visits, and soon medications and providers. Everyone sees the same thing, on any phone, even offline.",
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
        body: "Log what happened today, a symptom, a reading or a visit in a few taps. Everyone in the family sees the same timeline, in order.",
      },
      {
        icon: "notes",
        title: "Notes written together",
        body: "Take notes at an appointment while your brother adds what he heard on the phone. You both see the note as it's written.",
      },
      {
        icon: "vitals",
        title: "Vitals at a glance",
        body: "Blood pressure, temperature, weight, sleep and more, with the latest readings always at the top.",
      },
      {
        icon: "family",
        title: "Family, with the right access",
        body: "Caretakers can add and edit. Viewers can follow along without changing anything.",
      },
    ],
  } satisfies FeatureGridContent,

  gallery: {
    id: "see-it",
    heading: "See it on a phone",
    intro: "Real screens from Caretook, filled with made-up family data.",
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
        body: "Add a note, a symptom or a reading in seconds, even with no signal. It syncs when you're back online.",
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
        body: "Any AI provider we use may not keep your data or train on it.",
      },
      { icon: "delete", title: "Yours to delete", body: "You can delete your data whenever you want." },
    ],
  } satisfies PromiseContent,

  earlyAccess: {
    id: "early-access",
    heading: "Free while in early access",
    body: "Caretook is invitation-only while we build it with the first families. It's free during early access, and if that ever changes, you'll hear from us first.",
    actions: [],
  } satisfies CtaBandContent,

  waitlist: {
    id: "waitlist",
    heading: "Join the waitlist",
    body: "We're letting families in a few at a time. Leave your email and we'll tell you when there's room for yours.",
    note: "The waitlist opens soon.",
    actions: [{ label: "Have an access code?", href: MARKETING_LINKS.join }],
  } satisfies CtaBandContent,
};

export type HomeContent = typeof homeContent;
