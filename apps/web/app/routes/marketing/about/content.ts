import type { CtaBandContent, PageIntroContent, PageMeta, ProseContent } from "../sections/types";
import { MARKETING_LINKS, pagePath } from "../site/pages";

/**
 * About page copy (draft: the user edits it), but for the founder story
 * ("who") and the two bios under it: those are the founders' own words,
 * approved on 2026-11-25 and kept word for word (`content.test.ts` holds them).
 * The co-founder is named Tedder, with no pronoun.
 */
export const content = {
  meta: {
    title: "About",
    description:
      "Why Caretook, the free care notebook for families, exists: a calm, private place to keep track of a loved one's care together, and who's building it.",
  } satisfies PageMeta,

  intro: {
    heading: "About Caretook",
    lead: "Caring for someone is a family effort. Caretook gives that family one calm place to keep track of it, together.",
  } satisfies PageIntroContent,

  sections: [
    {
      id: "why",
      heading: "Why Caretook exists",
      paragraphs: [
        "When someone you love needs care, the details pile up fast: how they slept, what the doctor said, which reading looked off, who's taking them to Thursday's appointment. Most families keep track in group texts, paper notebooks and memory, and something always gets lost between siblings, shifts and visits.",
        "Caretook puts all of it on one shared timeline that everyone in the family can see and add to, from any phone, even with no signal. Notes from a visit are written together, so nobody has to retell the story three times.",
      ],
    },
    {
      id: "what-we-believe",
      heading: "What we believe",
      paragraphs: [
        "The person being cared for comes first. Their information is shared only with the people they agree to, and those people get only the access they need.",
        "Health information is private. We don't show ads, we don't sell data, no advertising or analytics tools can see your care data, and when you write to us, we'll delete your account and what's tied to it.",
        "Caretaking is hard enough. Caretook should be calm, quick and plain-spoken, and it should work in a waiting room with one bar of signal.",
      ],
    },
    {
      id: "who",
      heading: "Why we built Caretook",
      paragraphs: [
        "We're Bo and Tedder, partners in Mars Hill, North Carolina, and we've both been family caregivers.",
        "In early 2025, Tedder's father was diagnosed with stage IV lung cancer and died within a few months. Bo's father lived with multiple sclerosis for decades. Bo and his mother cared for him nearly full time through his last two years, until he died in hospice in the fall of 2026.",
        "The illnesses were different, but the work was the same. We kept medical details straight, tracked medications, kept doctors and family on the same page, and made hard decisions without all the facts. The timeline, printable medication sheets and visit notes we pieced together turned out to be the most useful things we had. Bringing all of it to an AI assistant helped us make sense of everything and keep up with the constant choices.",
        "We came to it from different directions. Tedder brought clinical and disaster resilience training to the hard conversations and the crises. Bo brought twenty years of building software and the habit of turning a mess into a system. Between us, we could see how those rough tools could become something better, for families who don't have the time to build their own.",
        "We cared for each other through both losses. Caretook is the tool we wish we'd had the energy to build while we were in the middle of it, made for any family managing long-term care, so the next family doesn't have to start from scratch.",
      ],
    },
    {
      id: "tedder",
      heading: "Tedder, MS, MSW, LCSW, LCASA",
      paragraphs: [
        "Co-founder. Master's degrees in social work and disaster resilience leadership from Tulane University.",
      ],
    },
    {
      id: "bo",
      heading: "Bo Davis",
      paragraphs: [
        "Co-founder. 20 years building software and leading technology teams, including as a startup CTO.",
      ],
    },
  ] satisfies ProseContent[],

  cta: {
    id: "talk-to-us",
    heading: "We'd like to hear from you",
    body: "Questions, ideas, or a story about caring for someone that we should hear? Write to us, or join the waitlist to try Caretook.",
    actions: [
      { label: "Contact us", href: pagePath("contact") },
      { label: "Join the waitlist", href: MARKETING_LINKS.waitlist },
    ],
  } satisfies CtaBandContent,
};

export type AboutContent = typeof content;
