import type { FaqGroup, PageIntroContent, PageMeta } from "../sections/types";

/**
 * FAQ copy (draft: the user edits it). The page and its `FAQPage` JSON-LD are
 * both built from `groups`, so they always match. Keep answers true to what
 * the app does today; anything that changes a privacy promise also changes
 * the privacy policy.
 */
export const content = {
  meta: {
    title: "FAQ",
    description:
      "Answers about what Caretook costs, who can see what, security, using it offline, leaving a care group and deleting your data.",
  } satisfies PageMeta,

  intro: {
    heading: "Questions and answers",
    lead: "The things families ask us most. If your question isn't here, write to us from the contact page.",
  } satisfies PageIntroContent,

  groups: [
    {
      id: "getting-started",
      heading: "Getting started",
      items: [
        {
          question: "What does Caretook cost?",
          answer: [
            "Caretook is free while in early access. If that ever changes, you'll hear from us well before anything does, and you'll be able to take your information with you.",
          ],
        },
        {
          question: "How do I get in?",
          answer: [
            "Caretook is invitation-only while we build it with the first families. Join the waitlist and we'll let you know when there's room for yours. If someone gave you an access code, or a family member invited you, you can start right away.",
          ],
        },
        {
          question: "Who is Caretook for?",
          answer: [
            "Families and friends looking after someone together: adult children caring for a parent, spouses, siblings, and anyone else helping out. It's built for the people doing the caring, not for clinics or agencies.",
          ],
        },
      ],
    },
    {
      id: "sharing-and-roles",
      heading: "Sharing and roles",
      items: [
        {
          question: "Who can see what we write?",
          answer: [
            "Only the members of your care group. Each care group is its own private space, and nobody outside it can see its timeline, notes or members.",
            "Caretook staff don't browse your care information. If support ever needs to look at something to help you, it will only be with your permission, and it will be recorded.",
          ],
        },
        {
          question: "What's the difference between a viewer and a caretaker?",
          answer: [
            "Caretakers can add, edit and delete entries and write notes. Viewers can see everything in the care group but can't change anything, which suits a relative who wants to stay informed.",
            "Owners and admins can also manage the group: rename it, update the profile of the person being cared for, change roles and remove members.",
          ],
        },
        {
          question: "Who decides who gets invited?",
          answer: [
            "The person being cared for comes first. We ask that you invite only the people they agree to share with. Owners and admins send the invitations and can remove someone at any time.",
          ],
        },
      ],
    },
    {
      id: "privacy-and-security",
      heading: "Privacy and security",
      items: [
        {
          question: "Is our information secure?",
          answer: [
            "Your information is encrypted when it travels between your phone and our servers, and encrypted where it's stored. Access is checked on our servers for every read and every change, so a person only ever gets what their role allows.",
            "Each phone keeps a copy of its care groups so the app works offline. Signing out removes that copy from the phone.",
          ],
        },
        {
          question: "Can I connect my own AI assistant like Claude or ChatGPT?",
          answer: [
            "Yes, if an owner of your care group has turned it on (it's off until they do). When you connect, what you can see in that group goes to the AI vendor you chose, under that vendor's terms. Contact details are never sent, and we keep no record of what the assistant read, only that you connected and when it was last used.",
            "You can disconnect in Settings, then Devices, and an owner can switch it off for the whole group.",
          ],
        },
        {
          question: "Do you sell our data or show ads?",
          answer: [
            "No. We never show ads, we never sell or rent your information, and no advertising or analytics tools can see your care data. Any AI provider we use may not keep your data or train on it.",
          ],
        },
      ],
    },
    {
      id: "using-caretook",
      heading: "Using Caretook",
      items: [
        {
          question: "Does it work offline?",
          answer: [
            "Yes. Once you've opened Caretook, you can keep reading the timeline and adding entries and notes with no signal. Everything you add syncs to the rest of the family as soon as you're back online.",
          ],
        },
        {
          question: "Can two of us write the same note at once?",
          answer: [
            "Yes. Notes and events are written together: everyone sees each other's words appear, and nothing anyone types is lost, even if one of you was offline.",
          ],
        },
      ],
    },
    {
      id: "your-data",
      heading: "Your data",
      items: [
        {
          question: "How do I leave a care group?",
          answer: [
            "Open the group's settings, go to Members, and choose Leave on your own row. The group disappears from your phone. What you added stays in the group's timeline for the rest of the family.",
          ],
        },
        {
          question: "How do I delete my data?",
          answer: [
            "You can delete your data whenever you want. While we're in early access, write to us from the contact page and we'll delete your account and what's tied to it, and confirm when it's done.",
          ],
        },
        {
          question: "What happens to our information if a care group is deleted?",
          answer: [
            "Everything in it is deleted with it: the timeline, notes, readings and memberships. Members' phones remove their copy the next time they sync.",
          ],
        },
      ],
    },
  ] satisfies FaqGroup[],
};

/** Every question, in page order (for the JSON-LD and tests). */
export const faqItems = content.groups.flatMap((g) => g.items);

export type FaqContent = typeof content;
