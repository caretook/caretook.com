import type {
  CtaBandContent,
  FeatureGridContent,
  PageMeta,
  PageIntroContent,
  ShowcaseContent,
} from "../sections/types";
import { MARKETING_LINKS } from "../site/pages";
import { PRICE_HEADLINE } from "../site/price";

/**
 * Features page copy (draft: the user edits it). Change the words here; the
 * layout is in the section components and `route.tsx`. Screenshots are named
 * from `site/screenshots.ts`, with alt text saying what each one shows.
 */
export const content = {
  meta: {
    title: "Features",
    description:
      "What's in Caretook, the free care notebook for families: a shared timeline, notes written together, vitals, a provider directory, sharing with the right access, and offline use.",
  } satisfies PageMeta,

  intro: {
    eyebrow: PRICE_HEADLINE,
    heading: "Everything your family needs to keep track, in one place",
    lead: "Caretook keeps a loved one's care in one shared timeline: what happened today, how they're feeling, their readings, and the notes from every visit. Here's how each part works.",
  } satisfies PageIntroContent,

  showcases: [
    {
      id: "timeline",
      icon: "timeline",
      heading: "One shared timeline",
      paragraphs: [
        "Everything about your loved one's day goes on one timeline, newest first, grouped by day. Add a note, a symptom, a reading or an event in a few taps, and everyone in the care group sees it at once.",
        "Show it as compact rows or roomier cards, and narrow it to just notes, symptoms, events or vitals with one tap.",
      ],
      points: [
        "Symptoms with how bad they are, from 0 to 10",
        "Events like a visit, a fall or a pickup",
        "Each entry shows who added it and when",
      ],
      image: {
        name: "timeline-rows",
        alt: "Grandma Pat's timeline on a phone: today's entries, with a note about lunch and blood pressure readings, and buttons to add a note, symptom, event or vitals.",
      },
    },
    {
      id: "notes-together",
      icon: "notes",
      heading: "Notes and events, written together",
      paragraphs: [
        "Start a note in one tap and just type: it's saved as you go. Your sister can open the same note and add to it at the same time, and you both see each other's words appear.",
        "When someone is writing, the timeline says so, with a Join button, so the notes from an appointment end up in one place instead of three text threads.",
      ],
      points: [
        "Headings, bold and lists for visit notes",
        "See who else has been writing",
        "Share a link to a note with the family",
      ],
      image: {
        name: "live-note",
        alt: "A note titled Cardiology follow-up, open on a phone, with notes from the visit and the next steps, and the initials of the other person writing it at the top.",
      },
    },
    {
      id: "live-now",
      icon: "family",
      heading: "See who's writing right now",
      paragraphs: [
        "A banner at the top of the timeline shows who is writing and what, so you can join in or simply follow along. A dot marks the entry being written.",
      ],
      image: {
        name: "live-now",
        alt: "The timeline in dark mode with a banner saying Dev Caretaker is writing Cardiology follow-up, a Join button, and the note at the top of today's entries.",
      },
    },
    {
      id: "vitals",
      icon: "vitals",
      heading: "Vitals at a glance",
      paragraphs: [
        "Blood pressure, heart rate, temperature, oxygen, weight, blood sugar, sleep and more. The latest readings sit at the top of the timeline; open them all with one tap.",
        "Enter readings in the units you're used to. If a number looks unusual, Caretook asks you to double-check it, and still saves it if it's right.",
      ],
      image: {
        name: "vitals",
        alt: "Every latest vital opened above the timeline: blood pressure, heart rate, oxygen, temperature, bowel movement, urine, sleep, weight, blood sugar and breathing rate, each with how long ago it was taken.",
      },
    },
    {
      id: "sharing",
      icon: "invite",
      heading: "Family, with the right access",
      paragraphs: [
        "A care group is the shared space for the person you care for. Invite only the people they agree to share with, and give each person a role.",
      ],
      points: [
        "Owners and admins manage who's in the group",
        "Caretakers add and edit entries",
        "Viewers can follow along without changing anything",
        "Anyone can leave a group whenever they like",
      ],
      image: {
        name: "members",
        alt: "A care group's members screen: three people, an owner, a caretaker and a viewer, each with their role.",
      },
    },
    {
      id: "providers",
      icon: "providers",
      heading: "Providers and contacts",
      paragraphs: [
        "Keep the doctors, practices, pharmacies and other helpers in one directory the whole care group shares, so nobody has to dig for a phone number in the middle of a hard day.",
        "Each provider has their phone numbers, address and website, and a shared notes page anyone in the group can add to, like the notes on an entry.",
      ],
      points: [
        "Mark the main doctor, and keep past providers for the record",
        "Clinicians linked to their practice",
        "Shared notes for each provider",
      ],
    },
    {
      id: "offline",
      icon: "offline",
      heading: "Works with no signal",
      paragraphs: [
        "Hospitals and waiting rooms often have poor reception. Caretook keeps a copy of your care group on your phone, so you can keep reading and adding entries with no signal. Everything syncs as soon as you're back online.",
      ],
    },
  ] satisfies ShowcaseContent[],

  coming: {
    id: "coming-soon",
    heading: "Coming soon",
    intro: "We're building this next, with the families using Caretook now.",
    items: [
      {
        icon: "medications",
        title: "Medications",
        body: "A list of current and past medications, with doses and why they were stopped, and a sheet you can print for the next appointment.",
      },
    ],
  } satisfies FeatureGridContent,

  cta: {
    id: "get-started",
    heading: "Ready when your family is",
    body: "Caretook is free for families. Join the waitlist, or use your access code if you have one.",
    actions: [
      { label: "Join the waitlist", href: MARKETING_LINKS.waitlist },
      { label: "Have an access code?", href: MARKETING_LINKS.join },
    ],
  } satisfies CtaBandContent,
};

export type FeaturesContent = typeof content;
