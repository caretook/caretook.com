import type { CtaBandContent, PageMeta, PageIntroContent, ShowcaseContent } from "../sections/types";
import { MARKETING_LINKS } from "../site/pages";
import { PRICE_HEADLINE } from "../site/price";

/**
 * Features page copy (draft: the user edits it). Change the words here; the
 * layout is in the section components and `route.tsx`. Screenshots are named
 * from `site/screenshots.ts`, with alt text saying what each one shows.
 *
 * Every block says only what the app does today, written from its area doc
 * (docs/domain/); a block without a screenshot shows its icon alone. Nothing
 * is listed as coming.
 */
export const content = {
  meta: {
    title: "Features",
    description:
      "What's in Caretook, the free care notebook for families: a shared timeline, notes written together, medications, todos and a planner, providers, and sharing with the right access.",
  } satisfies PageMeta,

  intro: {
    eyebrow: PRICE_HEADLINE,
    heading: "Everything your family needs to keep track, in one place",
    lead: "Caretook keeps a loved one's care in one shared place: what happened today, their medications and readings, what's coming up, and the notes from every visit. Here's how each part works.",
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
        "When someone is writing, the timeline says so, with a Join button, so the notes from a visit end up in one place instead of three text threads.",
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
      id: "quick-entry",
      icon: "quickEntry",
      heading: "Type it the way you'd say it",
      paragraphs: [
        "A box on the timeline takes a plain line, like “bp 130/85 hr 72, gave metformin, pain 4 left knee”, and turns it into separate entries: the readings, a dose and a symptom.",
        "Each part shows as a card before anything is saved, so you can check it, change what kind of entry it is, or remove it. One Save writes them all, with a few seconds to undo.",
      ],
      points: [
        "Readings, symptoms, doses, notes, events and todos",
        "Understands times like “last night” or “Friday 2pm”",
        "Runs on your phone: what you type isn't sent to an AI service",
        "Speak it with your keyboard's dictation",
      ],
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
      id: "medications",
      icon: "medications",
      heading: "Medications and doses",
      paragraphs: [
        "Keep every medication in one list the whole care group shares: prescriptions, over-the-counter medicines and supplements, each with its dose, directions, what it's for, the prescriber and the pharmacy. Stopped ones stay on record, with when and why.",
        "Group doses into med times like Morning and Evening. Today's schedule shows what's due and what's overdue, and logging a dose takes one tap: given, skipped or refused.",
      ],
      points: [
        "Mark a whole med time as given in one tap",
        "As-needed medications, with a check before you pass the daily maximum you set",
        "Doses and medication changes show on the timeline",
        "Allergies beside the list, and a warning when a medication's name matches one",
      ],
    },
    {
      id: "todos",
      icon: "todos",
      heading: "Todos, with a name on them",
      paragraphs: [
        "Write down what needs doing and who's doing it: call the pharmacy, book the follow-up, pick up the prescription. A todo can have a person, a due day and time, and its own notes.",
      ],
      points: [
        "Repeat a todo daily, weekly or monthly",
        "Link a todo to a provider, a medication, a note or an event",
        "Show only the ones assigned to you",
        "Viewers can tick off the todos assigned to them",
      ],
    },
    {
      id: "planner",
      icon: "planner",
      heading: "A planner for what's coming up",
      paragraphs: [
        "The Planner lists upcoming events and todos together by day, soonest first, with past events one tab away. An event can repeat, be rescheduled, or be cancelled with the reason kept.",
        "Before a visit, Prepare for this visit gathers what has changed since the last one with that provider (medication changes, readings and symptoms) and puts it at the top of the event's notes.",
      ],
    },
    {
      id: "calendars",
      icon: "calendars",
      heading: "In your own calendar, with reminders",
      paragraphs: [
        "Each person can see the care group's events and dated todos in the calendar they already use: subscribe to a calendar feed with a link of your own, or connect Google Calendar. When a caretaker moves an event's time in Google Calendar, it moves in Caretook too.",
        "Turn on reminder emails and choose when they arrive, from the evening before to 30 minutes ahead. It's all in Group settings, under Calendar & reminders.",
      ],
      points: [
        "Reminders are off until you turn them on, and each person sets their own",
        "A todo's reminder goes only to the person it's assigned to",
        "Outside Caretook, an event shows only who it's for and when, unless you choose to include the details",
        "With Google, Caretook adds a calendar of its own and can't see your others",
      ],
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
        "Viewers can follow along, and change nothing but ticking off a todo assigned to them",
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
        "Call, get directions or open the website from a provider's page",
        "Mention a provider in a note with @",
      ],
    },
    {
      id: "care-periods",
      icon: "carePeriods",
      heading: "Home, hospital, rehab: where they are now",
      paragraphs: [
        "Record where your loved one is staying and when that changed: home, the emergency room, hospital, rehab, assisted living, memory care, a nursing home or hospice. The timeline shows it on each day, like “In hospital · day 4”.",
        "Each stay keeps its place, the room and bed, and its own shared notes.",
      ],
      points: [
        "A marker on the timeline where each stay began",
        "Suggested when an event mentions being admitted or discharged",
        "Search within one stay",
      ],
    },
    {
      id: "profile",
      icon: "profile",
      heading: "A profile of the person you care for",
      paragraphs: [
        "One page for the facts people keep asking for: name, birthday and age, blood type, code status, language, conditions and allergies, and a note for anyone helping.",
        "Their phone, address and insurance are on it too, shown only to owners, admins and caretakers.",
      ],
      points: [
        "Conditions, with who diagnosed and who manages each",
        "Average readings over the last 7 and 30 days",
        "Emergency contacts, in the order to call",
        "Each family member chooses which of their own contact details the group sees",
      ],
    },
    {
      id: "printouts",
      icon: "print",
      heading: "Sheets to print",
      paragraphs: ["Some things are easier on paper. Caretook prints three sheets:"],
      points: [
        "The medication list: current medications by type, and recently stopped ones with why, under the allergies and conditions",
        "The weekly bedside sheet: seven days of medications, grouped by med time",
        "The profile sheet for emergencies: basics, contacts, insurance, medications, allergies, conditions and the care team",
      ],
    },
    {
      id: "search",
      icon: "search",
      heading: "Find anything, even offline",
      paragraphs: [
        "Search a care group from the magnifier in the header: timeline entries, providers, medications, conditions and todos. The search runs on your phone, so it works with no signal.",
      ],
      points: [
        "Matches are highlighted, with the words around them",
        "Put a phrase in quotes, or leave a word out with a minus sign",
        "Narrow a search to one care period",
      ],
    },
    {
      id: "assistants",
      icon: "assistant",
      heading: "Connect your own Claude or ChatGPT",
      paragraphs: [
        "If you already use Claude or ChatGPT, you can connect it to a care group and ask it to catch you up, or to help you get ready for an event. It reads what you can see in that group, and if you can add entries, it can add them for you, each marked with the assistant's name.",
        "It's off until an owner turns it on in Group settings, under Assistants. The address to give your assistant and the steps for each one are there and in Settings, under Devices, where you can also disconnect.",
        "It's your assistant, under its maker's terms: what it reads goes to the AI vendor you chose. Caretook itself doesn't use AI on your information.",
      ],
      points: [
        "One care group for each connection",
        "A viewer's assistant can read but not add",
        "Owners can make every connection read-only, or switch them all off",
        "Phone numbers, emails and addresses of family members and the person cared for are never sent",
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
