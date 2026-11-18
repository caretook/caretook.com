import type { LegalPageContent } from "../sections/legal";

/**
 * Terms of use (DRAFT for legal review: the user edits it). Placeholders are
 * in square brackets, such as [Company legal name] and [governing state].
 */
export const content = {
  meta: {
    title: "Terms",
    description:
      "The terms for using Caretook: your account, your care group's records, what Caretook is and isn't, and early access.",
  },
  heading: "Terms of use",
  lastUpdated: "2026-11-18",
  draft: true,
  intro: [
    "These terms are the agreement between you and Caretook when you use the website or the app. Each section starts with a short summary in plain words, followed by the formal text. If the two ever seem to differ, the formal text applies.",
    "How we handle your information is in our [Privacy policy](/privacy) and our [Consumer health data notice](/health-data-privacy).",
  ],
  sections: [
    {
      id: "agreement",
      heading: "The agreement",
      summary: "By using Caretook, you agree to these terms. If you don't agree, please don't use it.",
      formal: [
        'These Terms of Use ("Terms") are an agreement between you and [Company legal name] ("Caretook", "we", "us") governing your use of the website at caretook.com, the Caretook web app and any Caretook mobile app (the "Service"). By creating an account or using the Service, you agree to these Terms and acknowledge our [Privacy policy](/privacy).',
      ],
    },
    {
      id: "not-medical-advice",
      heading: "Caretook isn't medical care",
      summary:
        "Caretook is a place to keep notes and records. It doesn't give medical advice, doesn't watch for emergencies, and isn't a substitute for a doctor. In an emergency, call 911.",
      formal: [
        'The Service is a record-keeping and coordination tool. It does not provide medical advice, diagnosis or treatment, is not a medical device, and does not monitor entries or alert anyone to health conditions. Messages such as "That\'s unusual. Double-check it" only check that a value was typed correctly.',
        "Always seek the advice of a qualified health care provider about a medical condition. Never rely on the Service in an emergency: call 911 or your local emergency number.",
      ],
    },
    {
      id: "accounts",
      heading: "Your account",
      summary:
        "You must be 18 or older. Keep your sign-in details safe, and tell us if you think someone else has used your account.",
      formal: [
        "You must be at least 18 years old and able to form a binding contract to use the Service. Access is currently by invitation or access code. You are responsible for the accuracy of your account information, for keeping your credentials confidential, and for activity under your account. Notify us promptly at [support email] if you suspect unauthorized use.",
      ],
    },
    {
      id: "care-groups",
      heading: "Care groups and consent",
      summary:
        "A care group holds someone else's health information. Only record and share it with that person's permission (or their legal representative's), and only invite people they'd want to see it.",
      formal: [
        "When you create a care group, add records to one, or invite someone to one, you represent that you have the authority of the person being cared for, or of their legal representative, to record their information and share it with the group's members.",
        "Care group owners and admins decide who belongs to a group and what role each member has. Members with the caretaker role or above can add, change and delete records. Viewers can read but not change them. You are responsible for choosing members and roles carefully.",
      ],
    },
    {
      id: "your-content",
      heading: "Your content",
      summary:
        "What you and your family write belongs to you. You let us store and show it only so we can run Caretook for your care group.",
      formal: [
        'You keep ownership of the content you submit to the Service ("Your Content"). You grant Caretook a limited, non-exclusive, worldwide, royalty-free license to host, store, copy, transmit and display Your Content solely to provide the Service to you and the members of the care groups you share it with, and for no other purpose. This license ends when Your Content is deleted from the Service, except for copies in backups, which are deleted on our regular schedule.',
        "Records in a care group are shared with that group's members, and other members may rely on them. Records you add stay with the group if you leave it.",
      ],
    },
    {
      id: "acceptable-use",
      heading: "Using Caretook fairly",
      summary: "Use Caretook to care for someone, not to harm, spy on, or harass anyone, or to break it.",
      formal: [
        "You agree not to:",
        {
          list: [
            "use the Service to record information about a person without the authority described in [Care groups and consent](#care-groups);",
            "harass, threaten or harm anyone, or upload unlawful content;",
            "try to access accounts, care groups or data that you are not authorized to access;",
            "interfere with, overload or reverse engineer the Service, except where the law allows;",
            "use automated means to scrape or collect data from the Service;",
            "resell or provide the Service to others as a commercial offering.",
          ],
        },
      ],
    },
    {
      id: "early-access",
      heading: "Early access",
      summary:
        "Caretook is free while in early access. It's still being built, so features may change, and it may sometimes be unavailable.",
      formal: [
        "The Service is currently offered free of charge as an early access service. Features may change, be added or be removed. If we introduce paid plans, we will tell you in advance, and you will not be charged without agreeing to pay.",
        "The Service works offline and syncs when you reconnect. When two people change the same record while apart, the most recent change may replace the other. Please don't rely on Caretook as the only copy of information that matters.",
      ],
    },
    {
      id: "ending",
      heading: "Ending your use",
      summary:
        "You can stop using Caretook and ask us to delete your account at any time. We may close accounts that break these terms.",
      formal: [
        "You may stop using the Service at any time and ask us to delete your account as described in the [Privacy policy](/privacy#deletion). We may suspend or terminate access to the Service if you materially breach these Terms, if required by law, or if we stop offering the Service, in which case we will give reasonable notice where we can and a way to request a copy of your care records.",
      ],
    },
    {
      id: "disclaimers",
      heading: "Disclaimers",
      summary:
        "We work hard to keep Caretook reliable and safe, but we can't promise it will never fail or be wrong.",
      formal: [
        'TO THE FULLEST EXTENT PERMITTED BY LAW, THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE", WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE OR SECURE, OR THAT CONTENT ENTERED BY USERS IS ACCURATE.',
      ],
    },
    {
      id: "liability",
      heading: "Limits on liability",
      summary: "If something goes wrong, our responsibility is limited, as far as the law allows.",
      formal: [
        "TO THE FULLEST EXTENT PERMITTED BY LAW, CARETOOK WILL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL OR PUNITIVE DAMAGES, OR FOR ANY LOSS OF DATA, ARISING FROM YOUR USE OF THE SERVICE. OUR TOTAL LIABILITY FOR ANY CLAIM RELATING TO THE SERVICE WILL NOT EXCEED [liability cap]. Some jurisdictions do not allow these limitations, so they may not apply to you.",
      ],
    },
    {
      id: "law",
      heading: "Governing law and disputes",
      summary: "These terms follow the laws of [governing state]. [Dispute process to be decided.]",
      formal: [
        "These Terms are governed by the laws of [governing state], without regard to its conflict of laws rules. [Dispute resolution, venue and any arbitration terms: to be written in legal review.] Nothing in these Terms limits rights you have under consumer protection laws that cannot be waived.",
      ],
    },
    {
      id: "changes",
      heading: "Changes to these terms",
      summary:
        "If we change these terms, we'll update the date at the top and tell you about important changes first.",
      formal: [
        'We may update these Terms. The "last updated" date shows when they last changed. We will notify you of material changes in the Service or by email before they take effect. Continuing to use the Service after a change takes effect means you accept the updated Terms.',
      ],
    },
    {
      id: "contact",
      heading: "Contact us",
      summary: "Questions about these terms: [support email], or our contact page.",
      formal: [
        "[Company legal name], [mailing address]. Email: [support email]. You can also reach us through the [contact page](/contact).",
      ],
    },
  ],
} satisfies LegalPageContent;
