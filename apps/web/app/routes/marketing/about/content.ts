import type { CtaBandContent, PageIntroContent, PageMeta, ProseContent } from "../sections/types";
import { MARKETING_LINKS, pagePath } from "../site/pages";

/**
 * About page copy (draft: the user edits it). "Who's behind it" is a
 * placeholder, marked on the page, for the team to write in its own words.
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
        "Health information is private. We don't show ads, we don't sell data, no advertising or analytics tools can see your care data, and you can delete your data whenever you want.",
        "Caretaking is hard enough. Caretook should be calm, quick and plain-spoken, and it should work in a waiting room with one bar of signal.",
      ],
    },
    {
      id: "who",
      heading: "Who's behind Caretook",
      placeholder: true,
      paragraphs: [
        "This section is waiting for the team to write it: who we are, why we started Caretook, and how to reach us.",
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
